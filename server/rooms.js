const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const { promisify } = require('util');

// scrypt is deliberately CPU/memory-hard (that's what makes it resist
// brute-forcing), which also means scryptSync blocks Node's single event
// loop thread for the full hash duration - under concurrent traffic that
// stalls every other request and socket event on the server, not just the
// one hashing a password. The async form runs off the main thread instead.
const scrypt = promisify(crypto.scrypt);

// Hard cap enforced here (not just in the client's pre-join check, which is
// both racy and trivially bypassed). A mesh of 4 is already heavy per-browser.
const MAX_PARTICIPANTS = 4;

const createStore = () => ({
  connectedUsers: [],
  rooms: [],
});

const hashPassword = async (password) => {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = (await scrypt(password, salt, 64)).toString('hex');
  return `${salt}:${hash}`;
};

const verifyPassword = async (password, storedHash) => {
  const [salt, hash] = storedHash.split(':');
  const candidate = await scrypt(password || '', salt, 64);
  const stored = Buffer.from(hash, 'hex');
  return candidate.length === stored.length && crypto.timingSafeEqual(candidate, stored);
};

const getRoomStatus = (store, roomId) => {
  const room = store.rooms.find((room) => room.id === roomId);
  if (!room) {
    return { roomExists: false };
  }
  return {
    roomExists: true,
    full: room.connectedUsers.length >= MAX_PARTICIPANTS,
    passwordProtected: !!room.passwordHash,
  };
};

const createRoom = async (store, identity, socketId, password) => {
  const roomId = uuidv4();
  // Hash BEFORE touching the store: the await yields, and a socket that
  // disconnects during it would otherwise leave a user pushed into the
  // store with a room that gets created after its disconnect already ran -
  // an orphan room nobody can ever leave or close.
  const passwordHash = password ? await hashPassword(password) : null;
  const newUser = { identity, id: uuidv4(), socketId, roomId };

  store.connectedUsers.push(newUser);

  const newRoom = {
    id: roomId,
    connectedUsers: [newUser],
    passwordHash,
  };
  store.rooms.push(newRoom);

  return { roomId, user: newUser, room: newRoom };
};

// read-only check reused by both the socket join handler (below) and the
// LiveKit token endpoint, which needs to verify a room's password without
// mutating membership - the socket join is still the source of truth for
// who's actually in a room.
const checkRoomAccess = async (store, roomId, password) => {
  const room = store.rooms.find((room) => room.id === roomId);
  if (!room) {
    return { error: 'not-found' };
  }

  if (room.passwordHash && !(await verifyPassword(password, room.passwordHash))) {
    return { error: 'invalid-password' };
  }

  return { room };
};

const joinRoom = async (store, roomId, identity, socketId, password) => {
  const access = await checkRoomAccess(store, roomId, password);
  if (access.error) {
    return access;
  }
  const { room } = access;

  if (room.connectedUsers.length >= MAX_PARTICIPANTS) {
    return { error: 'full' };
  }

  const newUser = { identity, id: uuidv4(), socketId, roomId };
  room.connectedUsers = [...room.connectedUsers, newUser];
  store.connectedUsers.push(newUser);

  return { user: newUser, room };
};

// The room creator is always connectedUsers[0] (createRoom seeds it there
// and joinRoom only ever appends) - reused as the sole source of truth for
// "who is allowed to remove a participant" so a moderation request can be
// checked against the server's own membership record, never the client's
// self-reported isRoomHost flag.
const isMember = (store, roomId, socketId) => {
  const room = store.rooms.find((room) => room.id === roomId);
  return !!room && room.connectedUsers.some((u) => u.socketId === socketId);
};

const getUserBySocketId = (store, socketId) => {
  return store.connectedUsers.find((user) => user.socketId === socketId) || null;
};

const getRoomUserCount = (store, roomId) => {
  const room = store.rooms.find((room) => room.id === roomId);
  return room ? room.connectedUsers.length : 0;
};

const isRoomHost = (store, roomId, socketId) => {
  const room = store.rooms.find((room) => room.id === roomId);
  return !!room && room.connectedUsers[0]?.socketId === socketId;
};

const disconnectUser = (store, socketId) => {
  const user = store.connectedUsers.find((user) => user.socketId === socketId);
  if (!user) {
    return null;
  }

  store.connectedUsers = store.connectedUsers.filter((u) => u.socketId !== socketId);

  const room = store.rooms.find((room) => room.id === user.roomId);
  if (!room) {
    return { user, room: null, roomClosed: false };
  }

  room.connectedUsers = room.connectedUsers.filter((u) => u.socketId !== socketId);

  let roomClosed = false;
  if (room.connectedUsers.length === 0) {
    store.rooms = store.rooms.filter((r) => r.id !== room.id);
    roomClosed = true;
  }

  return { user, room, roomClosed };
};

module.exports = {
  createStore,
  getRoomStatus,
  checkRoomAccess,
  createRoom,
  joinRoom,
  isRoomHost,
  isMember,
  getUserBySocketId,
  getRoomUserCount,
  disconnectUser,
  MAX_PARTICIPANTS,
};
