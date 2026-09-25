const express = require('express');
const { getIce } = require("./controllers/getIce");
const cors = require('cors');
const job = require('./cron.js');
const roomsStore = require('./rooms');

// Cron Job to keep the server alive
job.start();

const app = express()
const http = require('http');
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ["GET", "POST"]
  }
});


app.use(cors());
app.use(express.json());

const store = roomsStore.createStore();

app.get("/ice", getIce);
app.get(`/api/room-exists/:roomId`, (req, res) => {
  const { roomId } = req.params;
  return res.send(roomsStore.getRoomStatus(store, roomId));
});


// when client connects
io.on('connection', socket => {
  console.log('client-connected', socket.id)

  // client asks to create a room
  socket.on('create-room', ({ identity }) => {
    createNewRoomHandler(identity, socket);
  })

  socket.on('join-room', (data) => {
    const { roomId, identity } = data;
    if (roomId === null) return
    joinRoomHandler(roomId, identity, socket);
  })

  socket.on('conn-signal', (data) => {
    signalHandler(data, socket);
  })

  socket.on('conn-init', (data) => {
    initConnHandler(data, socket);
  })

  // chat room message logic
  socket.on('send-message', (data) => {
    const { roomId } = data;
    const { message, messageId } = data.message;
    socket.broadcast.to(roomId).emit('receive-message', { message, messageId, socketId: socket.id });
  });

  // user disconnect
  socket.on('disconnect', () => {
    disconnectHandler(socket);
  });
})

// socket io handlers
const createNewRoomHandler = (identity, socket) => {

  const { roomId: newRoomId, room: newRoom } = roomsStore.createRoom(store, identity, socket.id);

  // joining the new room
  socket.join(newRoomId);

  // emit to the client which created the room
  socket.emit('room-id', { roomId: newRoomId });

  // emit event to all users connected, about new users
  socket.emit('room-update', { connectedUsers: newRoom.connectedUsers })
}

const joinRoomHandler = (roomId, identity, socket) => {

  const result = roomsStore.joinRoom(store, roomId, identity, socket.id);
  if (!result) return;
  const { room } = result;

  //moving socket to the room
  socket.join(roomId);

  // emit to room to prepare for webRTC connection
  const data = { connUserSocketId: socket.id };
  socket.broadcast.to(roomId).emit('prepare-webRTC', data);

  // room update of connected user.
  io.to(roomId).emit('room-update', { connectedUsers: room.connectedUsers });

}

const disconnectHandler = (socket) => {
  const result = roomsStore.disconnectUser(store, socket.id);
  if (result && result.room) {
    const { room, roomClosed } = result;

    socket.leave(room.id);

    // emit to all users that user disconnected
    io.to(room.id).emit('user-disconnected', { socketId: socket.id });

    // room update, or nothing left to update if the room closed
    if (!roomClosed) {
      io.to(room.id).emit('room-update', { connectedUsers: room.connectedUsers });
    }
  }
  console.log('socket-dc', socket.id);
}

const signalHandler = (data, socket) => {
  const { signal, connUserSocketId } = data;
  const signalingData = { signal, connUserSocketId: socket.id };
  socket.to(connUserSocketId).emit('conn-signal', signalingData);
}

const initConnHandler = (data, socket) => {
  const { connUserSocketId } = data;
  const initData = { connUserSocketId: socket.id };
  io.to(connUserSocketId).emit('conn-init', initData);
}

const PORT = process.env.PORT || 5000

server.listen(PORT, () => {
  console.log('listening on :', PORT);
});


