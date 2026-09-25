const {
  createStore,
  getRoomStatus,
  createRoom,
  joinRoom,
  disconnectUser,
} = require('./rooms');

describe('rooms store', () => {
  let store;

  beforeEach(() => {
    store = createStore();
  });

  it('reports a room as not existing when it was never created', () => {
    expect(getRoomStatus(store, 'missing-room')).toEqual({ roomExists: false });
  });

  it('creates a room with its host as the first participant', () => {
    const { roomId, user, room } = createRoom(store, 'host', 'socket-1');

    expect(room.connectedUsers).toEqual([user]);
    expect(user.identity).toBe('host');
    expect(getRoomStatus(store, roomId)).toEqual({ roomExists: true, full: false });
  });

  it('lets a second user join an existing room', () => {
    const { roomId } = createRoom(store, 'host', 'socket-1');

    const result = joinRoom(store, roomId, 'guest', 'socket-2');

    expect(result.room.connectedUsers).toHaveLength(2);
    expect(result.room.connectedUsers[1].identity).toBe('guest');
  });

  it('returns null when joining a room that does not exist', () => {
    expect(joinRoom(store, 'no-such-room', 'guest', 'socket-2')).toBeNull();
  });

  it('marks a room full once it has more than 4 participants', () => {
    const { roomId } = createRoom(store, 'host', 'socket-1');
    joinRoom(store, roomId, 'guest-2', 'socket-2');
    joinRoom(store, roomId, 'guest-3', 'socket-3');
    joinRoom(store, roomId, 'guest-4', 'socket-4');

    expect(getRoomStatus(store, roomId)).toEqual({ roomExists: true, full: true });
  });

  it('removes a user on disconnect but keeps the room open for the rest', () => {
    const { roomId } = createRoom(store, 'host', 'socket-1');
    joinRoom(store, roomId, 'guest', 'socket-2');

    const result = disconnectUser(store, 'socket-2');

    expect(result.roomClosed).toBe(false);
    expect(result.room.connectedUsers).toHaveLength(1);
    expect(result.room.connectedUsers[0].identity).toBe('host');
  });

  it('closes the room once its last participant disconnects', () => {
    const { roomId } = createRoom(store, 'host', 'socket-1');

    const result = disconnectUser(store, 'socket-1');

    expect(result.roomClosed).toBe(true);
    expect(getRoomStatus(store, roomId)).toEqual({ roomExists: false });
  });

  it('does nothing when disconnecting a socket that was never connected', () => {
    expect(disconnectUser(store, 'unknown-socket')).toBeNull();
  });
});
