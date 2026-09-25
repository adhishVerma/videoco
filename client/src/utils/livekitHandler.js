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

    const { token, url } = await api.getLiveKitToken(resolvedRoomId, identity, socket.id, roomPassword);

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

    await room.connect(url, token);

    const localTracks = await createLocalTracks({
        audio: true,
        video: onlyAudio ? false : { width: 480, height: 360 },
    });

    const localStream = new MediaStream(localTracks.map((t) => t.mediaStreamTrack));
    dispatchLocalStream(localStream);

    for (const track of localTracks) {
        await room.localParticipant.publishTrack(track);
    }

    // pick up anyone already in the room when we joined
    room.remoteParticipants.forEach((participant) => {
        participant.trackPublications.forEach((publication) => {
            if (publication.track) upsertRemoteTrack(participant.identity, publication.track);
        });
    });
};

export const disconnectLiveKitRoom = () => {
    if (room) {
        room.disconnect();
        room = null;
    }
    remoteStreams = [];
    usingLiveKit = false;
};

export const setLiveKitCameraEnabled = async (enabled) => {
    if (room) await room.localParticipant.setCameraEnabled(enabled);
};

export const setLiveKitMicEnabled = async (enabled) => {
    if (room) await room.localParticipant.setMicrophoneEnabled(enabled);
};

export const setLiveKitScreenShareEnabled = async (enabled) => {
    if (room) await room.localParticipant.setScreenShareEnabled(enabled);
};
