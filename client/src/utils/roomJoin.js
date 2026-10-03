import * as wss from './wss';
import { socket } from './wss';
import { CallConnectionError, JoinRejectedError } from './errors';

export const JOIN_TIMEOUT_MS = 15000;

// Resolves once the socket.io room is created/joined, with the final roomId
// (the server generates it for a host). Rejects if the join is refused
// (JoinRejectedError - Room.jsx already toasts the matching 'join-error'
// event) or if the server simply never answers (CallConnectionError) - that
// second case used to leave the screen spinning forever.
export const joinSocketRoom = (isRoomHost, identity, roomId, password, timeoutMs = JOIN_TIMEOUT_MS) => new Promise((resolve, reject) => {
    let timer;

    const cleanup = () => {
        clearTimeout(timer);
        socket.off('room-id', onRoomId);
        socket.off('room-update', onRoomUpdate);
        window.removeEventListener('join-error', onJoinError);
    };
    const onRoomId = ({ roomId: createdId }) => {
        if (!isRoomHost) return;
        cleanup();
        resolve({ roomId: createdId });
    };
    const onRoomUpdate = () => {
        if (isRoomHost) return;
        cleanup();
        resolve({ roomId });
    };
    const onJoinError = (event) => {
        cleanup();
        reject(new JoinRejectedError(event.detail && event.detail.reason));
    };

    // listen BEFORE asking, so a fast reply can't slip past
    socket.on('room-id', onRoomId);
    socket.on('room-update', onRoomUpdate);
    window.addEventListener('join-error', onJoinError);
    timer = setTimeout(() => {
        cleanup();
        reject(new CallConnectionError('Timed out joining the room'));
    }, timeoutMs);

    if (isRoomHost) {
        wss.createNewRoom(identity, password);
    } else {
        wss.joinRoom(identity, roomId, password);
    }
});
