import io from 'socket.io-client';
import {store} from '../store/store';
import { setRoomId, setParticipants } from '../store/actions';
import * as webRTCHandler from './webRTCHandler';

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

    socket.on('prepare-webRTC', (data) => {
        const {connUserSocketId} = data;

        webRTCHandler.prepareNewPeerConnection(connUserSocketId, false);

        // inform the user who just joined that we are prepared for incoming conneciton.
        socket.emit('conn-init', {connUserSocketId : connUserSocketId});
    })

    socket.on('conn-signal', (data) => {
        webRTCHandler.handleSignalingData(data);
    })

    socket.on('conn-init' , (data) => {
        const {connUserSocketId} = data;
        webRTCHandler.prepareNewPeerConnection(connUserSocketId, true);
    })

    socket.on('user-disconnected', (data) => {
        webRTCHandler.removePeerConnection(data);
    })
}

export const createNewRoom = (identity) => {
    const data = {
        identity
    }
    socket.emit('create-room', data);
}

export const joinRoom = (identity, roomId) => {

    const data = {
        identity,
        roomId
    }
    socket.emit('join-room', data);
}

export const signalPeerData = (data) => {
    socket.emit('conn-signal', data);
}

export {socket}