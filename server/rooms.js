const { v4: uuidv4 } = require('uuid');

const createStore = () => ({
  connectedUsers: [],
  rooms: [],
});

const getRoomStatus = (store, roomId) => {
  const room = store.rooms.find((room) => room.id === roomId);
  if (!room) {
    return { roomExists: false };
  }
  return { roomExists: true, full: room.connectedUsers.length > 3 };
};

const createRoom = (store, identity, socketId) => {
  const roomId = uuidv4();
  const newUser = { identity, id: uuidv4(), socketId, roomId };

  store.connectedUsers.push(newUser);

  const newRoom = { id: roomId, connectedUsers: [newUser] };
  store.rooms.push(newRoom);

  return { roomId, user: newUser, room: newRoom };
};

const joinRoom = (store, roomId, identity, socketId) => {
  const room = store.rooms.find((room) => room.id === roomId);
  if (!room) {
    return null;
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
