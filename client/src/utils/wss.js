import io from 'socket.io-client';
import {store} from '../store/store';
import { setRoomId, setParticipants } from '../store/actions';
import * as webRTCHandler from './webRTCHandler';
import * as livekitHandler from './livekitHandler';

const SERVER = `${process.env.REACT_APP_BACKEND_URL}`


let socket = null;

export const connectWithSocketIOServer = () => {
    socket = io(SERVER);
    console.log(socket)

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

export const signalPeerData = (data) => {
    socket.emit('conn-signal', data);
}

export const sendCaption = (text) => {
    const { roomId } = store.getState();
    if (!roomId) return;
    socket.emit('send-caption', { roomId, text });
}

export {socket}