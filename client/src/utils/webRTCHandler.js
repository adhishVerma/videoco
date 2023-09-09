import { fetchTURNCredentials, getTurnIceServers } from './turn';
import * as wss from './wss';
import Peer from 'simple-peer';


const defaultConsttraints = {
    audio: true,
    video: { width: '480', height: '360' },
}

const onlyAudioConstraints = {
    audio : true,
    video : false
}

let localStream;
let remoteStreams = [];


export const getLocalPreviewAndInitRoomConnection = async (
    isRoomHost,
    identity,
    roomId = null,
    onlyAudio
) => {

    const constraints = onlyAudio ? onlyAudioConstraints : defaultConsttraints;

    await fetchTURNCredentials();

    navigator.mediaDevices.getUserMedia(constraints).then(stream => {
        localStream = stream
        showLocalVideoPreview(localStream);
        isRoomHost ? wss.createNewRoom(identity) : wss.joinRoom(identity, roomId);

    }).catch((err) => {
        console.log(err)
    })
}


let peers = {};
let streams = [];

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
        console.log('new stream came');
        addStream(stream, connUserSocketId);
        streams = [...streams, stream];
    });

}

export const handleSignalingData = (data) => {
    // add signaling data to peer conn
    peers[data.connUserSocketId].signal(data.signal);
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
    const updatedStreams = [...remoteStreams, { stream: stream, id: connUserSocketId }]
    remoteStreams = updatedStreams;
    const event = new CustomEvent('catch-remote-stream', {
        detail: {
            streams: updatedStreams
        }
    })
    window.dispatchEvent(event);
}

export const switchVideoTracks = (stream) => {
    for (let socket_id in peers) {
        for (let index in peers[socket_id].streams[0].getTracks()) {
            for (let index2 in stream.getTracks()) {
                if (
                    peers[socket_id].streams[0].getTracks()[index].kind ===
                    stream.getTracks()[index2].kind
                ) {
                    peers[socket_id].replaceTrack(
                        peers[socket_id].streams[0].getTracks()[index],
                        stream.getTracks()[index2],
                        peers[socket_id].streams[0]
                    );
                    break;
                }
            }
        }
    }
};

