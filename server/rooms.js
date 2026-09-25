const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');

const createStore = () => ({
  connectedUsers: [],
  rooms: [],
});

const hashPassword = (password) => {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
};

const verifyPassword = (password, storedHash) => {
  const [salt, hash] = storedHash.split(':');
  const candidate = crypto.scryptSync(password || '', salt, 64);
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
    full: room.connectedUsers.length > 3,
    passwordProtected: !!room.passwordHash,
  };
};

const createRoom = (store, identity, socketId, password) => {
  const roomId = uuidv4();
  const newUser = { identity, id: uuidv4(), socketId, roomId };

  store.connectedUsers.push(newUser);

  const newRoom = {
    id: roomId,
    connectedUsers: [newUser],
    passwordHash: password ? hashPassword(password) : null,
  };
  store.rooms.push(newRoom);

  return { roomId, user: newUser, room: newRoom };
};

const joinRoom = (store, roomId, identity, socketId, password) => {
  const room = store.rooms.find((room) => room.id === roomId);
  if (!room) {
    return { error: 'not-found' };
  }

  if (room.passwordHash && !verifyPassword(password, room.passwordHash)) {
    return { error: 'invalid-password' };
  }

  const newUser = { identity, id: uuidv4(), socketId, roomId };
  room.connectedUsers = [...room.connectedUsers, newUser];
  store.connectedUsers.push(newUser);

  return { user: newUser, room };
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
  createRoom,
  joinRoom,
  disconnectUser,
};
