import { fetchTURNCredentials, getTurnIceServers } from './turn';
import * as wss from './wss';
import * as livekitHandler from './livekitHandler';
import { CallConnectionError, JoinRejectedError } from './errors';
import { SessionCancelled, beginSession, endSession, ensureCurrent, isCurrentSession } from './callSession';
import { CALL_STATUS, setCallStatus } from './callStatus';
import { joinSocketRoom } from './roomJoin';
import Peer from 'simple-peer';


const defaultConsttraints = {
    audio: true,
    video: { width: '480', height: '360' },
}

const onlyAudioConstraints = {
    audio : true,
    video : false
}

let localStream = null;
let remoteStreams = [];
let peers = {};
let localVideoEnabled = true;

// Disabling a video track just makes it send black frames, so peers can't
// tell the camera is off - say so explicitly.
export const setLocalVideoEnabled = (enabled) => {
    localVideoEnabled = enabled;
    wss.sendMediaState(enabled);
};

export const isLocalVideoEnabled = () => localVideoEnabled;


const stopLocalStream = () => {
    if (localStream) {
        localStream.getTracks().forEach((t) => t.stop());
        localStream = null;
    }
};

// Starts (or restarts) a call attempt. Always begins a fresh session, so any
// attempt still in flight from before is cancelled and cleans up after itself.
export const getLocalPreviewAndInitRoomConnection = async (
    isRoomHost,
    identity,
    roomId = null,
    onlyAudio,
    roomPassword
) => {
    const sessionId = beginSession();
    setCallStatus(CALL_STATUS.STARTING);
    // harmless if we end up on the mesh instead; saves a round trip if not
    livekitHandler.preloadLiveKit();

    try {
        const liveKitAvailable = await livekitHandler.isLiveKitAvailable();
        ensureCurrent(sessionId);

        if (liveKitAvailable) {
            await livekitHandler.startLiveKitFlow(isRoomHost, identity, roomId, onlyAudio, roomPassword, sessionId);
        } else {
            await startMeshFlow(isRoomHost, identity, roomId, onlyAudio, roomPassword, sessionId);
        }
    } catch (err) {
        if (err instanceof SessionCancelled) return;
        console.log('call failed to start', err, err.cause || '');
        const isConnectionProblem = err instanceof CallConnectionError;
        const eventName = isConnectionProblem ? 'call-connection-error' : 'media-access-error';
        window.dispatchEvent(new CustomEvent(eventName, { detail: { error: err } }));
        if (isCurrentSession(sessionId)) {
            setCallStatus(CALL_STATUS.FAILED, { kind: isConnectionProblem ? 'connection' : 'media' });
        }
    }
}

// The peer-to-peer fallback, used when the server has no LiveKit configured.
// Same ordering as the LiveKit flow: camera first, so the preview shows even
// if the network steps after it are slow.
const startMeshFlow = async (isRoomHost, identity, roomId, onlyAudio, roomPassword, sessionId) => {
    const constraints = onlyAudio ? onlyAudioConstraints : defaultConsttraints;

    setCallStatus(CALL_STATUS.MEDIA);
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    if (!isCurrentSession(sessionId)) {
        stream.getTracks().forEach((t) => t.stop());
        throw new SessionCancelled();
    }
    localStream = stream;
    showLocalVideoPreview(localStream);

    try {
        setCallStatus(CALL_STATUS.JOINING);
        // best effort - a missing TURN server only costs us callers behind
        // strict NATs, it shouldn't stop the call from starting
        await fetchTURNCredentials();
        ensureCurrent(sessionId);
        await joinSocketRoom(isRoomHost, identity, roomId, roomPassword);
        ensureCurrent(sessionId);
    } catch (err) {
        if (isCurrentSession(sessionId) || err instanceof SessionCancelled) stopLocalStream();
        // a refused join is already reported by Room.jsx's 'join-error' listener
        if (err instanceof JoinRejectedError) return;
        throw err;
    }

    setCallStatus(CALL_STATUS.CONNECTED);
}

// Tears down EVERYTHING a call holds, whichever transport it used. Safe to
// call at any point, including mid-connect and more than once.
//
// `keepRoomState` is for a retry, which re-uses the room details the page
// already has; a real exit clears them so the next visit doesn't show a
// stale room id.
export const leaveCall = ({ keepRoomState = false } = {}) => {
    endSession();
    livekitHandler.disconnectLiveKitRoom();

    Object.keys(peers).forEach((id) => {
        try { peers[id].destroy(); } catch (err) { /* already gone */ }
    });
    peers = {};
    remoteStreams = [];
    sentVideoTrack = null;
    localVideoEnabled = true;
    stopLocalStream();

    // without this the server keeps the user in the room until the whole
    // browser tab closes: a ghost participant who holds a seat and keeps a
    // room from ever closing
    wss.leaveRoom();
    if (!keepRoomState) wss.resetRoomState();
};


const getConfiguration = () => {

    const turnIceSevres = getTurnIceServers();

    if (turnIceSevres) {
        return {
            iceServers: [
                {
                    urls: `stun:stun.l.google.com:19302`
                },
                ...turnIceSevres
            ]
        }
    } else {
        return {
            iceServers: [
                {
                    urls: `stun:stun.l.google.com:19302`
                }
            ]
        }
    }
}

export const prepareNewPeerConnection = (connUserSocketId, isInitiator) => {
    const configuration = getConfiguration();

    // a second prepare for the same peer would orphan the first connection
    if (peers[connUserSocketId]) {
        try { peers[connUserSocketId].destroy(); } catch (err) { /* already gone */ }
    }

    peers[connUserSocketId] = new Peer({
        initiator: isInitiator,
        config: configuration,
        stream: localStream
    });

    peers[connUserSocketId].on('signal', (data) => {

        // webRTC offer, webRTC Answer(SDP), ice candidates
        const signalData = {
            signal: data,
            connUserSocketId: connUserSocketId
        };

        wss.signalPeerData(signalData);
    })

    peers[connUserSocketId].on('stream', (stream) => {
        addStream(stream, connUserSocketId);
    });

    peers[connUserSocketId].on('error', (err) => {
        console.log('peer connection error', connUserSocketId, err);
    });

}

export const handleSignalingData = (data) => {
    // a signal can arrive after that peer was already removed
    const peer = peers[data.connUserSocketId];
    if (peer) peer.signal(data.signal);
}

export const removePeerConnection = (data) => {
    const { socketId } = data;
    const event = new CustomEvent('remove-remote-stream', {
        detail: {
            socketId: socketId
        }
    })
    remoteStreams = remoteStreams.filter((stream) => stream.id !== socketId);
    if (peers[socketId]) {
        peers[socketId].destroy();
    }
    delete peers[socketId];
    window.dispatchEvent(event);
}

////////////////////////////////////////VIDEO STREAMS////////////////////////////////////////
const showLocalVideoPreview = (stream) => {
    const event = new CustomEvent('catch-local-stream', {
        detail: {
            stream: stream
        }
    })
    window.dispatchEvent(event);
}

const addStream = (stream, connUserSocketId) => {
    const updatedStreams = [...remoteStreams.filter((s) => s.id !== connUserSocketId), { stream: stream, id: connUserSocketId }]
    remoteStreams = updatedStreams;
    const event = new CustomEvent('catch-remote-stream', {
        detail: {
            streams: updatedStreams
        }
    })
    window.dispatchEvent(event);
}

// The video track our peers are currently receiving from us: the camera
// until a screen share replaces it, then back again.
let sentVideoTrack = null;

// replaceTrack needs the track we are *sending* (the local one) as its "old
// track" and the local stream it was originally added with - not anything
// from the peer's remote streams, which can never match a sender.
export const switchVideoTracks = (stream) => {
    const newTrack = stream && stream.getVideoTracks()[0];
    const oldTrack = sentVideoTrack || (localStream && localStream.getVideoTracks()[0]);
    if (!newTrack || !oldTrack || !localStream) return;

    Object.values(peers).forEach((peer) => {
        try {
            peer.replaceTrack(oldTrack, newTrack, localStream);
        } catch (err) {
            console.log('failed to switch video track for a peer', err);
        }
    });
    sentVideoTrack = newTrack;
};
