const {
  createStore,
  getRoomStatus,
  createRoom,
  joinRoom,
  isRoomHost,
  isMember,
  getUserBySocketId,
  getRoomUserCount,
  disconnectUser,
  MAX_PARTICIPANTS,
} = require('./rooms');

describe('rooms store', () => {
  let store;

  beforeEach(() => {
    store = createStore();
  });

  it('reports a room as not existing when it was never created', () => {
    expect(getRoomStatus(store, 'missing-room')).toEqual({ roomExists: false });
  });

  it('creates a room with its host as the first participant', async () => {
    const { roomId, user, room } = await createRoom(store, 'host', 'socket-1');

    expect(room.connectedUsers).toEqual([user]);
    expect(user.identity).toBe('host');
    expect(getRoomStatus(store, roomId)).toEqual({ roomExists: true, full: false, passwordProtected: false });
  });

  it('lets a second user join an existing room', async () => {
    const { roomId } = await createRoom(store, 'host', 'socket-1');

    const result = await joinRoom(store, roomId, 'guest', 'socket-2');

    expect(result.room.connectedUsers).toHaveLength(2);
    expect(result.room.connectedUsers[1].identity).toBe('guest');
  });

  it('returns a not-found error when joining a room that does not exist', async () => {
    expect(await joinRoom(store, 'no-such-room', 'guest', 'socket-2')).toEqual({ error: 'not-found' });
  });

  it('marks a room full once it has more than 4 participants', async () => {
    const { roomId } = await createRoom(store, 'host', 'socket-1');
    await joinRoom(store, roomId, 'guest-2', 'socket-2');
    await joinRoom(store, roomId, 'guest-3', 'socket-3');
    await joinRoom(store, roomId, 'guest-4', 'socket-4');

    expect(getRoomStatus(store, roomId)).toEqual({ roomExists: true, full: true, passwordProtected: false });
  });

  it('removes a user on disconnect but keeps the room open for the rest', async () => {
    const { roomId } = await createRoom(store, 'host', 'socket-1');
    await joinRoom(store, roomId, 'guest', 'socket-2');

    const result = disconnectUser(store, 'socket-2');

    expect(result.roomClosed).toBe(false);
    expect(result.room.connectedUsers).toHaveLength(1);
    expect(result.room.connectedUsers[0].identity).toBe('host');
  });

  it('closes the room once its last participant disconnects', async () => {
    const { roomId } = await createRoom(store, 'host', 'socket-1');

    const result = disconnectUser(store, 'socket-1');

    expect(result.roomClosed).toBe(true);
    expect(getRoomStatus(store, roomId)).toEqual({ roomExists: false });
  });

  it('does nothing when disconnecting a socket that was never connected', () => {
    expect(disconnectUser(store, 'unknown-socket')).toBeNull();
  });

  describe('capacity', () => {
    it('rejects a join once the room is at its participant limit', async () => {
      const { roomId } = await createRoom(store, 'host', 'socket-1');
      for (let i = 2; i <= MAX_PARTICIPANTS; i += 1) {
        expect((await joinRoom(store, roomId, `guest-${i}`, `socket-${i}`)).error).toBeUndefined();
      }

      const result = await joinRoom(store, roomId, 'one-too-many', 'socket-99');

      expect(result).toEqual({ error: 'full' });
      expect(getRoomUserCount(store, roomId)).toBe(MAX_PARTICIPANTS);
    });

    it('frees a seat when someone leaves', async () => {
      const { roomId } = await createRoom(store, 'host', 'socket-1');
      for (let i = 2; i <= MAX_PARTICIPANTS; i += 1) await joinRoom(store, roomId, `g${i}`, `socket-${i}`);
      disconnectUser(store, 'socket-2');

      expect((await joinRoom(store, roomId, 'late', 'socket-99')).error).toBeUndefined();
    });
  });

  describe('membership lookups', () => {
    it('knows who is actually in a room', async () => {
      const { roomId } = await createRoom(store, 'host', 'socket-1');

      expect(isMember(store, roomId, 'socket-1')).toBe(true);
      expect(isMember(store, roomId, 'stranger')).toBe(false);
      expect(isMember(store, 'no-such-room', 'socket-1')).toBe(false);
    });

    it('finds a user by socket id, and returns null for unknown sockets', async () => {
      await createRoom(store, 'host', 'socket-1');

      expect(getUserBySocketId(store, 'socket-1').identity).toBe('host');
      expect(getUserBySocketId(store, 'nope')).toBeNull();
    });

    it('counts 0 for a room that does not exist', () => {
      expect(getRoomUserCount(store, 'missing')).toBe(0);
    });

    it('stops reporting membership once a user has left', async () => {
      const { roomId } = await createRoom(store, 'host', 'socket-1');
      await joinRoom(store, roomId, 'guest', 'socket-2');
      disconnectUser(store, 'socket-2');

      expect(isMember(store, roomId, 'socket-2')).toBe(false);
    });
  });

  it('does not touch the store until a password hash has finished (no orphan on early disconnect)', async () => {
    const pending = createRoom(store, 'host', 'socket-1', 'letmein');

    expect(store.connectedUsers).toHaveLength(0);
    expect(store.rooms).toHaveLength(0);

    await pending;
    expect(store.rooms).toHaveLength(1);
  });

  describe('isRoomHost', () => {
    it('is true for the socket that created the room', async () => {
      const { roomId } = await createRoom(store, 'host', 'socket-1');

      expect(isRoomHost(store, roomId, 'socket-1')).toBe(true);
    });

    it('is false for a guest who joined afterwards', async () => {
      const { roomId } = await createRoom(store, 'host', 'socket-1');
      await joinRoom(store, roomId, 'guest', 'socket-2');

      expect(isRoomHost(store, roomId, 'socket-2')).toBe(false);
    });

    it('is false for a room that does not exist', () => {
      expect(isRoomHost(store, 'no-such-room', 'socket-1')).toBe(false);
    });

    it('migrates to the next-oldest participant once the host disconnects', async () => {
      const { roomId } = await createRoom(store, 'host', 'socket-1');
      await joinRoom(store, roomId, 'guest', 'socket-2');
      disconnectUser(store, 'socket-1');

      expect(isRoomHost(store, roomId, 'socket-2')).toBe(true);
    });
  });

  describe('password-protected rooms', () => {
    it('reports passwordProtected in room status', async () => {
      const { roomId } = await createRoom(store, 'host', 'socket-1', 'letmein');

      expect(getRoomStatus(store, roomId)).toEqual({ roomExists: true, full: false, passwordProtected: true });
    });

    it('lets a guest join with the correct password', async () => {
      const { roomId } = await createRoom(store, 'host', 'socket-1', 'letmein');

      const result = await joinRoom(store, roomId, 'guest', 'socket-2', 'letmein');

      expect(result.error).toBeUndefined();
      expect(result.room.connectedUsers).toHaveLength(2);
    });

    it('rejects a guest with the wrong password', async () => {
      const { roomId } = await createRoom(store, 'host', 'socket-1', 'letmein');

      const result = await joinRoom(store, roomId, 'guest', 'socket-2', 'wrong-password');

      expect(result).toEqual({ error: 'invalid-password' });
    });

    it('rejects a guest who supplies no password at all', async () => {
      const { roomId } = await createRoom(store, 'host', 'socket-1', 'letmein');

      const result = await joinRoom(store, roomId, 'guest', 'socket-2');

      expect(result).toEqual({ error: 'invalid-password' });
    });

    it('never stores the plaintext password on the room', async () => {
      const { room } = await createRoom(store, 'host', 'socket-1', 'letmein');

      expect(room.passwordHash).not.toBe('letmein');
      expect(room.passwordHash).toContain(':');
    });
  });
});
