import io from 'socket.io-client';
import {store} from '../store/store';
import { setRoomId, setParticipants } from '../store/actions';
import * as webRTCHandler from './webRTCHandler';
import * as livekitHandler from './livekitHandler';
import { CallConnectionError } from './errors';
import { endCall } from './callStatus';

const SERVER = `${process.env.REACT_APP_BACKEND_URL}`

const TOKEN_TIMEOUT_MS = 10000;

let socket = null;

// idempotent - the socket must exist before anything in a room tries to use it
export const connectWithSocketIOServer = () => {
    if (socket) return socket;
    socket = io(SERVER);

    socket.on('connect', () => {
        console.log(`success connection`, socket.id)
    })

    socket.on('room-id', ({roomId}) => {
        store.dispatch(setRoomId(roomId));
    })

    socket.on('room-update', (data) => {
        const { connectedUsers } = data;
        store.dispatch(setParticipants(connectedUsers));
    })

    // these four events only drive the peer-to-peer mesh - when LiveKit is
    // handling media instead, the server still emits them (it has no idea
    // which transport the client picked), so they're no-ops in that case.
    socket.on('prepare-webRTC', (data) => {
        if (livekitHandler.isUsingLiveKit()) return;
        const {connUserSocketId} = data;

        webRTCHandler.prepareNewPeerConnection(connUserSocketId, false);

        // inform the user who just joined that we are prepared for incoming conneciton.
        socket.emit('conn-init', {connUserSocketId : connUserSocketId});
        // ...and tell them whether our camera is on, since they weren't here
        // when we last changed it
        sendMediaState(webRTCHandler.isLocalVideoEnabled());
    })

    socket.on('conn-signal', (data) => {
        if (livekitHandler.isUsingLiveKit()) return;
        webRTCHandler.handleSignalingData(data);
    })

    socket.on('conn-init' , (data) => {
        if (livekitHandler.isUsingLiveKit()) return;
        const {connUserSocketId} = data;
        webRTCHandler.prepareNewPeerConnection(connUserSocketId, true);
    })

    socket.on('user-disconnected', (data) => {
        if (livekitHandler.isUsingLiveKit()) return;
        webRTCHandler.removePeerConnection(data);
    })

    socket.on('join-error', (data) => {
        const event = new CustomEvent('join-error', { detail: data });
        window.dispatchEvent(event);
    })

    socket.on('media-state', (data) => {
        window.dispatchEvent(new CustomEvent('remote-media-state', { detail: data }));
    })

    socket.on('removed-from-room', () => {
        window.dispatchEvent(new CustomEvent('removed-from-room'));
    })

    // The server forgets a user the moment their socket drops, and the
    // reconnected socket would be a brand new identity in no room - so a
    // lost connection can't be quietly resumed; the call is over. (A
    // disconnect we caused ourselves, 'io client disconnect', never lands here.)
    socket.on('disconnect', (reason) => {
        if (reason === 'io client disconnect') return;
        endCall('connection-lost');
    })

    // lone-participant countdown (see server/idle.js)
    socket.on('room-idle-warning', (data) => {
        window.dispatchEvent(new CustomEvent('room-idle-warning', { detail: data }));
    })

    socket.on('room-idle-timeout', () => {
        window.dispatchEvent(new CustomEvent('room-idle-timeout'));
    })

    return socket;
}

export const createNewRoom = (identity, password) => {
    const data = {
        identity,
        password
    }
    socket.emit('create-room', data);
}

export const joinRoom = (identity, roomId, password) => {

    const data = {
        identity,
        roomId,
        password
    }
    socket.emit('join-room', data);
}

export const leaveRoom = () => {
    if (socket && socket.connected) socket.emit('leave-room');
}

// the lone participant answering the idle warning with "keep it open"
export const extendRoom = () => {
    if (socket && socket.connected) socket.emit('extend-room');
}

// tells everyone else in the room whether our camera is on (see server/app.js)
export const sendMediaState = (video) => {
    if (socket && socket.connected) socket.emit('media-state', { video: !!video });
}

export const signalPeerData = (data) => {
    socket.emit('conn-signal', data);
}

export const sendCaption = (text) => {
    const { roomId } = store.getState();
    if (!roomId) return;
    socket.emit('send-caption', { roomId, text });
}

// server-side validated against the room's actual creator (see
// rooms.js#isRoomHost) - the UI only using this for isRoomHost participants
// is a convenience, not the actual security boundary.
export const removeParticipant = (targetSocketId) => {
    const { roomId } = store.getState();
    if (!roomId) return;
    socket.emit('remove-participant', { roomId, targetSocketId });
}

// The token is requested over the socket (not HTTP) so the server can bind
// it to this connection's own id and the room it knows we joined.
export const requestLiveKitToken = () => new Promise((resolve, reject) => {
    socket.timeout(TOKEN_TIMEOUT_MS).emit('livekit-token', {}, (err, response) => {
        if (err) return reject(new CallConnectionError('The call server did not respond with a call token', err));
        if (!response || response.error) {
            return reject(new CallConnectionError(`Failed to get a call token (${response ? response.error : 'no response'})`));
        }
        resolve(response);
    });
});

// forgets the room locally - used when actually leaving, not when retrying
export const resetRoomState = () => {
    store.dispatch(setRoomId(null));
    store.dispatch(setParticipants([]));
}

export const getSocket = () => socket;

export {socket}
