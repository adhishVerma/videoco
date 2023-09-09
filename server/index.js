const express = require('express');
const { getIce } = require("./controllers/getIce");
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');

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

let connectedUsers = [];
let rooms = []

app.get("/ice", getIce);
app.get(`/api/room-exists/:roomId`, (req, res) => {
  const { roomId } = req.params;
  const room = rooms.find((room) => room.id === roomId);
  console.log({roomId : roomId, room: room, rooms: rooms});
  if (room) {
      if (room.connectedUsers.length > 3) {
          return res.send({ roomExists: true, full: true });
      }else{
          return res.send({ roomExists: true, full: false });
      }
  } else {
      return res.send({ roomExists: false });
  }
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
    if(roomId === null) return
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
    socket.broadcast.to(roomId).emit('receive-message', { message, messageId, socketId : socket.id });
  });

  // user disconnect
  socket.on('disconnect', () => {
    disconnectHandler(socket);
  });
})

// socket io handlers
const createNewRoomHandler = (identity, socket) => {

  const roomId = uuidv4();

  // creating a new User
  const newUser = {
    identity,
    id: uuidv4(),
    socketId: socket.id,
    roomId
  }
  connectedUsers.push(newUser); //push the user to connectedUsers.

  const newRoom = {
    id: roomId,
    connectedUsers: [newUser]
  }
  // joining the new room
  socket.join(roomId);

  rooms = [...rooms, newRoom];
  console.log("pushed-room", rooms)


  // emit to the client which created the room
  socket.emit('room-id', { roomId });

  // emit event to all users connected, about new users
  socket.emit('room-update', { connectedUsers: newRoom.connectedUsers })
}

const joinRoomHandler = (roomId, identity, socket) => {

  const newUser = {
    identity,
    id: uuidv4(),
    socketId: socket.id,
    roomId
  }

  // adding user to the room arr
  const room = rooms.find((room) => room.id === roomId);
  room.connectedUsers = [... room.connectedUsers, newUser];

  //moving socket to the room
  socket.join(roomId);

  // adding new user to all user array
  connectedUsers.push(newUser);

  // emit to room to prepare for webRTC connection
  const data = {connUserSocketId : socket.id};
  socket.broadcast.to(roomId).emit('prepare-webRTC', data);

  // room update of connected user.
  io.to(roomId).emit('room-update', { connectedUsers: room.connectedUsers });

}

const disconnectHandler = (socket) => {
  // find if user has been registered.
  const user = connectedUsers.find(user => user.socketId === socket.id);
  if (user) {
    const users = connectedUsers.filter((user) => user.socketId !== socket.id);
    connectedUsers = users;

    const room = rooms.find(room => room.id === user.roomId);
    room.connectedUsers = room.connectedUsers.filter(user => user.socketId !== socket.id);

    socket.leave(user.roomId);

    // emit to all users that user disconnected
    io.to(room.id).emit('user-disconnected', {socketId : socket.id});

    // close the room if users left are 0
    if (room.connectedUsers.length > 0) {
      io.to(room.id).emit('room-update', { connectedUsers: room.connectedUsers });
    } else {
      rooms = rooms.filter((r) => r.id !== room.id);
    }
  }
  console.log('socket-dc', socket.id);
}

const signalHandler = (data, socket) => {
  const {signal, connUserSocketId} = data;
  const signalingData = {signal, connUserSocketId: socket.id};
  socket.to(connUserSocketId).emit('conn-signal', signalingData);
}

const initConnHandler = (data,socket) => {
  const {connUserSocketId} = data;
  const initData = {connUserSocketId: socket.id};
  io.to(connUserSocketId).emit('conn-init', initData);
}

const PORT = process.env.PORT || 5000

server.listen(PORT, () => {
  console.log('listening on :', PORT);
});
