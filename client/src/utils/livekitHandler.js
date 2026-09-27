import { Room, RoomEvent, createLocalTracks } from 'livekit-client';
import * as api from './api';
import * as wss from './wss';
import { socket } from './wss';

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

let room = null;
let usingLiveKit = false;
let remoteStreams = [];
const remoteMediaStreams = {}; // LiveKit participant identity (== our socket id) -> MediaStream

export const isUsingLiveKit = () => usingLiveKit;

export const isLiveKitAvailable = async () => {
    try {
        const { enabled } = await api.getLiveKitStatus();
        return enabled;
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
// the first toggle off. Rebuild it from whatever's actually published
// any time that changes.
const refreshLocalStream = () => {
    if (!room) return;
    const tracks = [];
    room.localParticipant.trackPublications.forEach((publication) => {
        if (publication.track) tracks.push(publication.track.mediaStreamTrack);
    });
    dispatchLocalStream(new MediaStream(tracks));
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

const removeRemoteParticipant = (participantId) => {
    delete remoteMediaStreams[participantId];
    remoteStreams = remoteStreams.filter((s) => s.id !== participantId);
    dispatchRemoveRemoteStream(participantId);
};

// resolves once the socket.io room is created/joined, handing back the
// final roomId (the server generates it for a host) before we ask for a
// LiveKit token for that same room. Rejects if the join is refused (wrong
// password, room gone) - Room.jsx's existing join-error listener already
// shows the toast and navigates away, so this just needs to stop here.
const waitForRoomReady = (isRoomHost) => new Promise((resolve, reject) => {
    const cleanup = () => {
        socket.off('room-id', onRoomId);
        socket.off('room-update', onRoomUpdate);
        window.removeEventListener('join-error', onJoinError);
    };
    const onRoomId = ({ roomId }) => {
        if (!isRoomHost) return;
        cleanup();
        resolve(roomId);
    };
    const onRoomUpdate = () => {
        if (isRoomHost) return;
        cleanup();
        resolve(null);
    };
    const onJoinError = () => {
        cleanup();
        reject(new Error('join-error'));
    };
    socket.on('room-id', onRoomId);
    socket.on('room-update', onRoomUpdate);
    window.addEventListener('join-error', onJoinError);
});

export const startLiveKitFlow = async (isRoomHost, identity, roomId, onlyAudio, roomPassword) => {
    usingLiveKit = true;

    let resolvedRoomId;
    try {
        const roomReadyPromise = waitForRoomReady(isRoomHost);
        isRoomHost ? wss.createNewRoom(identity, roomPassword) : wss.joinRoom(identity, roomId, roomPassword);
        const readyResult = await roomReadyPromise;
        resolvedRoomId = isRoomHost ? readyResult : roomId;
    } catch (err) {
        usingLiveKit = false;
        return;
    }

    let token, url;
    try {
        ({ token, url } = await api.getLiveKitToken(resolvedRoomId, identity, socket.id, roomPassword));
    } catch (err) {
        usingLiveKit = false;
        throw new CallConnectionError('Failed to get a call token from the server', err);
    }

    room = new Room();

    room.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
        upsertRemoteTrack(participant.identity, track);
    });

    room.on(RoomEvent.TrackUnsubscribed, (track) => {
        track.detach();
    });

    room.on(RoomEvent.ParticipantDisconnected, (participant) => {
        removeRemoteParticipant(participant.identity);
    });

    room.on(RoomEvent.Disconnected, () => {
        usingLiveKit = false;
    });

    room.on(RoomEvent.LocalTrackPublished, refreshLocalStream);
    room.on(RoomEvent.LocalTrackUnpublished, refreshLocalStream);

    try {
        await room.connect(url, token);
    } catch (err) {
        usingLiveKit = false;
        throw new CallConnectionError('Failed to connect to the LiveKit server', err);
    }

    // getUserMedia genuinely failing (permission denied, no device, device
    // busy) only happens here - keep this in its own try/catch so it's the
    // only path that reports a camera/mic problem to the user. Anything
    // above this point (token fetch, WebSocket connect) is a connection
    // problem, not a permissions one, and reports as such instead.
    let localTracks;
    try {
        localTracks = await createLocalTracks({
            audio: true,
            video: onlyAudio ? false : { width: 480, height: 360 },
        });
    } catch (err) {
        room.disconnect();
        room = null;
        usingLiveKit = false;
        throw err;
    }

    const localStream = new MediaStream(localTracks.map((t) => t.mediaStreamTrack));
    dispatchLocalStream(localStream);

    try {
        for (const track of localTracks) {
            await room.localParticipant.publishTrack(track);
        }
    } catch (err) {
        usingLiveKit = false;
        throw new CallConnectionError('Failed to publish local tracks to the call', err);
    }

    // pick up anyone already in the room when we joined
    room.remoteParticipants.forEach((participant) => {
        participant.trackPublications.forEach((publication) => {
            if (publication.track) upsertRemoteTrack(participant.identity, publication.track);
        });
    });
};

// distinguishes "we couldn't reach/use the call server" from an actual
// getUserMedia permission/device failure, so the UI can show an accurate
// message instead of always blaming the camera/mic.
export class CallConnectionError extends Error {
    constructor(message, cause) {
        super(message);
        this.name = 'CallConnectionError';
        this.cause = cause;
    }
}

export const disconnectLiveKitRoom = () => {
    if (room) {
        room.disconnect();
        room = null;
    }
    remoteStreams = [];
    usingLiveKit = false;
};

export const setLiveKitCameraEnabled = async (enabled) => {
    if (!room) return;
    await room.localParticipant.setCameraEnabled(enabled);
    // Toggling off/on goes through mute/restart internally rather than a
    // clean unpublish+republish, which doesn't reliably fire
    // LocalTrackPublished/Unpublished (the room-level listeners above cover
    // other cases, like screen share, but not this one) - refresh
    // explicitly right after the operation we know just happened.
    refreshLocalStream();
};

export const setLiveKitMicEnabled = async (enabled) => {
    if (!room) return;
    await room.localParticipant.setMicrophoneEnabled(enabled);
    refreshLocalStream();
};

export const setLiveKitScreenShareEnabled = async (enabled) => {
    if (room) await room.localParticipant.setScreenShareEnabled(enabled);
};
