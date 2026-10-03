import * as api from './api';
import * as wss from './wss';
import { CallConnectionError, JoinRejectedError } from './errors';
import { SessionCancelled, ensureCurrent, isCurrentSession } from './callSession';
import { CALL_STATUS, setCallStatus, endCall } from './callStatus';
import { joinSocketRoom } from './roomJoin';
import { withTimeout } from './timeout';

// LiveKit replaces the peer-to-peer mesh (webRTCHandler.js) as the media
// transport once the server reports it's configured - see
// GET /api/livekit-status. socket.io stays the control plane either way
// (room membership, password checks, chat, captions); this module only
// swaps out how audio/video actually gets from A to B.
//
// It dispatches the exact same window CustomEvents the mesh path does
// (catch-local-stream / catch-remote-stream / remove-remote-stream) so
// Stream.jsx, Video.jsx and the rest of the UI don't need to know which
// transport is active.

export { CallConnectionError };

// livekit-client is the single biggest dependency, and the home and join
// pages never touch it - load it only once a call actually starts. The call
// flow kicks this off in parallel with its server check (preloadLiveKit), so
// it doesn't delay the camera preview.
let livekitModule = null;
const loadLiveKit = async () => {
    if (!livekitModule) livekitModule = await import('livekit-client');
    return livekitModule;
};
export const preloadLiveKit = () => {
    loadLiveKit().catch(() => {});
};

export const CONNECT_TIMEOUT_MS = 20000;
export const PUBLISH_TIMEOUT_MS = 15000;

// LiveKit's Track.Source.ScreenShare - spelled out so this module doesn't
// need the Track class just for one constant.
const SCREEN_SHARE_SOURCE = 'screen_share';

let room = null;
let usingLiveKit = false;
// Rooms WE chose to disconnect (leaving, retrying, cleaning up a failed
// attempt). Tracked per room, not as one global flag: a cancelled attempt can
// still be unwinding while its replacement is already connecting.
const closedByUs = new WeakSet();
let remoteStreams = [];
const remoteMediaStreams = {}; // LiveKit participant identity (== our socket id) -> MediaStream

export const isUsingLiveKit = () => usingLiveKit;

export const isLiveKitAvailable = async () => {
    try {
        const { enabled } = await api.getLiveKitStatus();
        return !!enabled;
    } catch (err) {
        return false;
    }
};

const dispatchLocalStream = (stream) => {
    window.dispatchEvent(new CustomEvent('catch-local-stream', { detail: { stream } }));
};

// setCameraEnabled(false) stops the camera track outright (turns the
// camera light off), and re-enabling publishes a brand new track object -
// so the local preview's MediaStream, built once after the initial
// publish, would otherwise keep pointing at a dead track forever after
// the first toggle off. Rebuild it from whatever's actually published any
// time that changes. Skips re-dispatching when nothing actually changed
// (same track ids + readyStates) so the polling helper below doesn't
// spam the local preview with identical MediaStream objects every 150ms.
//
// A screen share is left out on purpose: it's a second video track, and
// the self-view tile should keep showing the camera, not flip to the screen.
let lastLocalTrackSignature = '';
const refreshLocalStream = () => {
    if (!room) return;
    const tracks = [];
    room.localParticipant.trackPublications.forEach((publication) => {
        if (publication.track && publication.source !== SCREEN_SHARE_SOURCE) {
            tracks.push(publication.track.mediaStreamTrack);
        }
    });
    const signature = tracks.map((t) => `${t.id}:${t.readyState}`).join(',');
    if (signature === lastLocalTrackSignature) return;
    lastLocalTrackSignature = signature;
    dispatchLocalStream(new MediaStream(tracks));
};

// setCameraEnabled/setMicrophoneEnabled's own promise can resolve before
// LiveKit's internal track-restart (reacquiring the camera/mic hardware
// after a mute) has actually swapped the new MediaStreamTrack into the
// publication - refreshing exactly once right after can grab a track
// that's still ended/stale. Keep sampling briefly instead of trusting a
// single point in time; refreshLocalStream's own dedup keeps this from
// causing extra re-renders once the track has actually stabilized.
const pollLocalStreamUntilStable = () => {
    let attempts = 0;
    const tick = () => {
        refreshLocalStream();
        attempts += 1;
        if (attempts < 10) setTimeout(tick, 150);
    };
    tick();
};

const dispatchRemoteStreams = () => {
    window.dispatchEvent(new CustomEvent('catch-remote-stream', { detail: { streams: remoteStreams } }));
};

const dispatchRemoveRemoteStream = (participantId) => {
    window.dispatchEvent(new CustomEvent('remove-remote-stream', { detail: { socketId: participantId } }));
};

const upsertRemoteTrack = (participantId, track) => {
    if (!remoteMediaStreams[participantId]) {
        remoteMediaStreams[participantId] = new MediaStream();
    }
    const mediaStream = remoteMediaStreams[participantId];

    mediaStream.getTracks()
        .filter((t) => t.kind === track.kind)
        .forEach((t) => mediaStream.removeTrack(t));
    mediaStream.addTrack(track.mediaStreamTrack);

    const existingIndex = remoteStreams.findIndex((s) => s.id === participantId);
    const entry = { stream: mediaStream, id: participantId };
    remoteStreams = existingIndex >= 0
        ? [...remoteStreams.slice(0, existingIndex), entry, ...remoteStreams.slice(existingIndex + 1)]
        : [...remoteStreams, entry];

    dispatchRemoteStreams();
};

// A remote participant turning their camera/mic fully off unpublishes the
// track; leaving its dead MediaStreamTrack in their stream would freeze the
// last frame (or keep a silent audio track) on everyone else's screen.
const removeRemoteTrack = (participantId, track) => {
    const mediaStream = remoteMediaStreams[participantId];
    if (!mediaStream) return;
    mediaStream.getTracks()
        .filter((t) => t === track.mediaStreamTrack)
        .forEach((t) => mediaStream.removeTrack(t));
    if (remoteStreams.some((s) => s.id === participantId)) {
        remoteStreams = [...remoteStreams];
        dispatchRemoteStreams();
    }
};

// A remote participant toggling their camera/mic goes through the same
// mute/restart mechanism as the local side (see refreshLocalStream) - it
// fires TrackMuted/TrackUnmuted, not TrackSubscribed/Unsubscribed, so
// without this a peer's video would freeze on the last frame and never
// come back once they toggled it off and on again.
const refreshRemoteParticipant = (participantId) => {
    const participant = room?.remoteParticipants.get(participantId);
    if (!participant) return;
    participant.trackPublications.forEach((publication) => {
        if (publication.track) upsertRemoteTrack(participantId, publication.track);
    });
};

const removeRemoteParticipant = (participantId) => {
    delete remoteMediaStreams[participantId];
    remoteStreams = remoteStreams.filter((s) => s.id !== participantId);
    dispatchRemoveRemoteStream(participantId);
};

const registerRoomHandlers = (liveKitRoom, RoomEvent) => {
    liveKitRoom.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
        upsertRemoteTrack(participant.identity, track);
    });

    liveKitRoom.on(RoomEvent.TrackUnsubscribed, (track, publication, participant) => {
        track.detach();
        if (participant) removeRemoteTrack(participant.identity, track);
    });

    liveKitRoom.on(RoomEvent.ParticipantDisconnected, (participant) => {
        removeRemoteParticipant(participant.identity);
    });

    // LiveKit retries a dropped connection on its own first; only a final
    // Disconnected means the call is actually gone.
    liveKitRoom.on(RoomEvent.Reconnecting, () => {
        setCallStatus(CALL_STATUS.RECONNECTING);
    });

    liveKitRoom.on(RoomEvent.Reconnected, () => {
        setCallStatus(CALL_STATUS.CONNECTED);
    });

    liveKitRoom.on(RoomEvent.Disconnected, () => {
        // leaving on purpose also lands here - only a drop we didn't cause
        // should tell the UI the call ended underneath the user
        if (closedByUs.has(liveKitRoom)) return;
        if (room === liveKitRoom) {
            usingLiveKit = false;
            endCall('media-disconnected');
        }
    });

    liveKitRoom.on(RoomEvent.LocalTrackPublished, refreshLocalStream);
    liveKitRoom.on(RoomEvent.LocalTrackUnpublished, (publication) => {
        refreshLocalStream();
        // the browser's own "Stop sharing" button unpublishes the screen
        // track without going through our toggle - tell the button
        if (publication && publication.source === SCREEN_SHARE_SOURCE) {
            window.dispatchEvent(new CustomEvent('screen-share-ended'));
        }
    });

    // The actual mechanism a camera/mic toggle uses - mute() typically
    // stops the underlying hardware track (turns the camera light off)
    // without unpublishing, and unmute() restarts it with a new
    // MediaStreamTrack under the same publication. Covers both our own
    // toggle (backing up the explicit refresh in setLiveKitCameraEnabled/
    // setLiveKitMicEnabled below) and, critically, a remote participant's
    // toggle, which nothing else here was listening for at all.
    liveKitRoom.on(RoomEvent.TrackMuted, (publication, participant) => {
        if (participant.isLocal) {
            pollLocalStreamUntilStable();
        } else if (publication && publication.kind === 'video' && publication.track) {
            // Take a muted camera out of their stream so the tile switches to
            // its avatar at once. Waiting for the browser to notice the media
            // stopped (MediaStreamTrack.muted) takes seconds and shows a frozen
            // last frame meanwhile. TrackUnmuted puts it back below.
            removeRemoteTrack(participant.identity, publication.track);
        } else {
            refreshRemoteParticipant(participant.identity);
        }
    });
    liveKitRoom.on(RoomEvent.TrackUnmuted, (publication, participant) => {
        participant.isLocal ? pollLocalStreamUntilStable() : refreshRemoteParticipant(participant.identity);
    });
};

const resetState = () => {
    remoteStreams = [];
    Object.keys(remoteMediaStreams).forEach((id) => delete remoteMediaStreams[id]);
    lastLocalTrackSignature = '';
};

// Order matters here, and it's deliberately NOT "connect, then open the
// camera": the user's own preview must appear the instant the camera is
// granted, regardless of how slow (or broken) the network steps after it
// are. Previously the preview waited on the room join, the token request and
// the LiveKit connection, so any of them stalling meant a blank screen with
// no explanation.
//
// `sessionId` (see callSession.js) lets a user who leaves or retries mid-way
// cancel the flow; every await is followed by a check, and anything already
// acquired is released.
export const startLiveKitFlow = async (isRoomHost, identity, roomId, onlyAudio, roomPassword, sessionId) => {
    usingLiveKit = true;
    resetState();

    let localTracks = [];
    let myRoom = null;

    // only report progress for the attempt that's still the live one
    const status = (value) => {
        if (isCurrentSession(sessionId)) setCallStatus(value);
    };

    // Releases only what THIS attempt acquired. If it was cancelled because a
    // newer attempt took over, the module-level room/usingLiveKit now belong
    // to that newer attempt and must be left alone.
    const release = () => {
        localTracks.forEach((t) => t.stop());
        localTracks = [];
        if (myRoom) {
            closedByUs.add(myRoom);
            myRoom.disconnect();
            if (room === myRoom) room = null;
            myRoom = null;
        }
        if (isCurrentSession(sessionId)) usingLiveKit = false;
    };

    try {
        // 1. camera/mic -> instant preview. getUserMedia failing (permission
        // denied, no device, device busy) is the only thing reported as a
        // camera/mic problem, so it throws untouched.
        status(CALL_STATUS.MEDIA);
        const { Room, RoomEvent, createLocalTracks } = await loadLiveKit();
        ensureCurrent(sessionId);
        localTracks = await createLocalTracks({
            audio: true,
            video: onlyAudio ? false : { width: 480, height: 360 },
        });
        ensureCurrent(sessionId);
        dispatchLocalStream(new MediaStream(localTracks.map((t) => t.mediaStreamTrack)));

        // 2. enter the room over the control-plane socket
        status(CALL_STATUS.JOINING);
        await joinSocketRoom(isRoomHost, identity, roomId, roomPassword);
        ensureCurrent(sessionId);

        // 3. a token bound to this socket, then the media server
        const { token, url } = await wss.requestLiveKitToken();
        ensureCurrent(sessionId);

        status(CALL_STATUS.CONNECTING);
        myRoom = new Room();
        room = myRoom;
        registerRoomHandlers(myRoom, RoomEvent);
        try {
            await withTimeout(
                myRoom.connect(url, token),
                CONNECT_TIMEOUT_MS,
                () => new CallConnectionError('Timed out connecting to the media server'),
            );
        } catch (err) {
            // release() disconnects myRoom, which also stops a connect() that
            // gave up waiting from completing later and leaving a live session
            throw err instanceof CallConnectionError ? err : new CallConnectionError('Failed to connect to the media server', err);
        }
        ensureCurrent(sessionId);

        // 4. publish what we already captured
        try {
            for (const track of localTracks) {
                await withTimeout(
                    myRoom.localParticipant.publishTrack(track),
                    PUBLISH_TIMEOUT_MS,
                    () => new CallConnectionError('Timed out publishing to the call'),
                );
                ensureCurrent(sessionId);
            }
        } catch (err) {
            if (err instanceof SessionCancelled) throw err;
            throw err instanceof CallConnectionError ? err : new CallConnectionError('Failed to publish local tracks to the call', err);
        }

        // pick up anyone already in the room when we joined
        myRoom.remoteParticipants.forEach((participant) => {
            participant.trackPublications.forEach((publication) => {
                if (publication.track) upsertRemoteTrack(participant.identity, publication.track);
            });
        });

        status(CALL_STATUS.CONNECTED);
    } catch (err) {
        release();
        // a cancelled session or a refused join isn't a failure to report
        if (err instanceof SessionCancelled || err instanceof JoinRejectedError) return;
        throw err;
    }
};

export const disconnectLiveKitRoom = () => {
    if (room) {
        closedByUs.add(room);
        room.disconnect();
        room = null;
    }
    resetState();
    usingLiveKit = false;
};

export const setLiveKitCameraEnabled = async (enabled) => {
    if (!room) return;
    await room.localParticipant.setCameraEnabled(enabled);
    // Toggling off/on goes through mute/restart internally rather than a
    // clean unpublish+republish, which doesn't reliably fire
    // LocalTrackPublished/Unpublished (the room-level listeners above cover
    // other cases, like screen share, but not this one), and the restart
    // itself can still be finishing after this await resolves - poll
    // briefly rather than trusting a single refresh right here.
    pollLocalStreamUntilStable();
};

export const setLiveKitMicEnabled = async (enabled) => {
    if (!room) return;
    await room.localParticipant.setMicrophoneEnabled(enabled);
    pollLocalStreamUntilStable();
};

export const setLiveKitScreenShareEnabled = async (enabled) => {
    if (room) await room.localParticipant.setScreenShareEnabled(enabled);
};
