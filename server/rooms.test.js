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
    expect(getRoomStatus(store, roomId)).toEqual({ roomExists: true, full: false, passwordProtected: false });
  });

  it('lets a second user join an existing room', () => {
    const { roomId } = createRoom(store, 'host', 'socket-1');

    const result = joinRoom(store, roomId, 'guest', 'socket-2');

    expect(result.room.connectedUsers).toHaveLength(2);
    expect(result.room.connectedUsers[1].identity).toBe('guest');
  });

  it('returns a not-found error when joining a room that does not exist', () => {
    expect(joinRoom(store, 'no-such-room', 'guest', 'socket-2')).toEqual({ error: 'not-found' });
  });

  it('marks a room full once it has more than 4 participants', () => {
    const { roomId } = createRoom(store, 'host', 'socket-1');
    joinRoom(store, roomId, 'guest-2', 'socket-2');
    joinRoom(store, roomId, 'guest-3', 'socket-3');
    joinRoom(store, roomId, 'guest-4', 'socket-4');

    expect(getRoomStatus(store, roomId)).toEqual({ roomExists: true, full: true, passwordProtected: false });
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

  describe('password-protected rooms', () => {
    it('reports passwordProtected in room status', () => {
      const { roomId } = createRoom(store, 'host', 'socket-1', 'letmein');

      expect(getRoomStatus(store, roomId)).toEqual({ roomExists: true, full: false, passwordProtected: true });
    });

    it('lets a guest join with the correct password', () => {
      const { roomId } = createRoom(store, 'host', 'socket-1', 'letmein');

      const result = joinRoom(store, roomId, 'guest', 'socket-2', 'letmein');

      expect(result.error).toBeUndefined();
      expect(result.room.connectedUsers).toHaveLength(2);
    });

    it('rejects a guest with the wrong password', () => {
      const { roomId } = createRoom(store, 'host', 'socket-1', 'letmein');

      const result = joinRoom(store, roomId, 'guest', 'socket-2', 'wrong-password');

      expect(result).toEqual({ error: 'invalid-password' });
    });

    it('rejects a guest who supplies no password at all', () => {
      const { roomId } = createRoom(store, 'host', 'socket-1', 'letmein');

      const result = joinRoom(store, roomId, 'guest', 'socket-2');

      expect(result).toEqual({ error: 'invalid-password' });
    });

    it('never stores the plaintext password on the room', () => {
      const { room } = createRoom(store, 'host', 'socket-1', 'letmein');

      expect(room.passwordHash).not.toBe('letmein');
      expect(room.passwordHash).toContain(':');
    });
  });
});
