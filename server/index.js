const express = require('express');
const { getIce } = require("./controllers/getIce");
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const job = require('./cron.js');
const roomsStore = require('./rooms');

// Cron Job to keep the server alive
job.start();

// comma-separated list of allowed client origins, e.g. "https://videoco.vercel.app,http://localhost:3000"
const allowedOrigins = (process.env.CLIENT_URL || 'http://localhost:3000')
  .split(',')
  .map((origin) => origin.trim());

const corsOptions = {
  origin: allowedOrigins,
  methods: ["GET", "POST"]
};

const app = express()
const http = require('http');
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server, {
  cors: corsOptions
});


app.use(cors(corsOptions));
app.use(express.json());

const store = roomsStore.createStore();

// TURN credentials mint a real (billed) Twilio resource, and room-exists is a
// cheap enumeration target - both get a conservative per-IP rate limit.
const iceLimiter = rateLimit({ windowMs: 60 * 1000, limit: 10, standardHeaders: true, legacyHeaders: false });
const roomLookupLimiter = rateLimit({ windowMs: 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false });

app.get("/ice", iceLimiter, getIce);
app.get(`/api/room-exists/:roomId`, roomLookupLimiter, (req, res) => {
  const { roomId } = req.params;
  return res.send(roomsStore.getRoomStatus(store, roomId));
});


// when client connects
io.on('connection', socket => {
  console.log('client-connected', socket.id)

  // client asks to create a room
  socket.on('create-room', ({ identity, password }) => {
    createNewRoomHandler(identity, socket, password);
  })

  socket.on('join-room', (data) => {
    const { roomId, identity, password } = data;
    if (roomId === null) return
    joinRoomHandler(roomId, identity, socket, password);
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

  // live caption relay - text only, never persisted
  socket.on('send-caption', (data) => {
    const { roomId, text } = data;
    socket.broadcast.to(roomId).emit('receive-caption', { text, socketId: socket.id });
  });

  // user disconnect
  socket.on('disconnect', () => {
    disconnectHandler(socket);
  });
})

// socket io handlers
const createNewRoomHandler = (identity, socket, password) => {

  const { roomId: newRoomId, room: newRoom } = roomsStore.createRoom(store, identity, socket.id, password);

  // joining the new room
  socket.join(newRoomId);

  // emit to the client which created the room
  socket.emit('room-id', { roomId: newRoomId });

  // emit event to all users connected, about new users
  socket.emit('room-update', { connectedUsers: newRoom.connectedUsers })
}

const joinRoomHandler = (roomId, identity, socket, password) => {

  const result = roomsStore.joinRoom(store, roomId, identity, socket.id, password);
  if (result.error) {
    socket.emit('join-error', { reason: result.error });
    return;
  }
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


