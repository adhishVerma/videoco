const express = require('express');
const { getIce } = require("./controllers/getIce");
const cors = require('cors');

const app = express()
const http = require('http');
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server, {
  cors : {
    origin : '*'
  }
});


app.use(cors());

app.use(express.json());
app.get("/ice", getIce);

const emailToSocket = new Map();
const socketToEmail = new Map();

// when client connects
io.on('connection', socket => {
  console.log('user connected', socket.id)
  // when user logs in
  socket.on('login', (data) => {
    const { email } = data
    emailToSocket.set(email, socket);
    socketToEmail.set(socket, email);
  })

  // when socket wants to join a room
  socket.on('join-room', (data) => {
    const { emailId, roomId, userEmail } = data;

    // socket is moved to roomId
    socket.join(roomId);
    socket.emit('joined-room', { roomId })
    socket.broadcast.to(roomId).emit('user-joined', { emailId });

    // asking another user to move to the same room
    const guestSocket = emailToSocket.get(emailId)
    if (guestSocket) {
      guestSocket.emit('incoming-call', { roomId, from: userEmail })
    }
  })

  socket.on('pick-call', (data) => {
    const { roomId, emailId } = data;
    socket.join(roomId);
    socket.emit('joined-room', { roomId })
    socket.broadcast.to(roomId).emit('user-joined', { emailId });
  })


  // passing new ice candidates
  socket.on('new-ice-candidate', (data) => {
    const { candidate, roomId } = data;
    socket.broadcast.to(roomId).emit('new-ice-candidate', { candidate })
  })

  //  on video-offer
  socket.on('video-offer', (data) => {
    const { roomId, offer } = data;
    socket.broadcast.to(roomId).emit('video-offer', { offer })
  })

  // on video-answer
  socket.on('video-answer', (data) => {
    const { roomId, answer } = data;
    socket.broadcast.to(roomId).emit('video-answer', { answer })
  })


  socket.on('nego-offer', (data) => {
    const { roomId, offer } = data;
    socket.broadcast.to(roomId).emit('nego-offer', { offer });
  })

  socket.on('nego-ans', (data) => {
    const { roomId, answer } = data;
    socket.broadcast.to(roomId).emit('nego-final', { answer });
  });

  // chat room message logic
  socket.on('send-message', (data) => {
    const {roomId} = data;
    const {message, messageId} = data.message;
    socket.broadcast.to(roomId).emit('receive-message', {message, messageId});
  });

  // user disconnect
  socket.on('disconnect', () => {
    // console.log(`user disconnected: ${socket.id}`);
    // const email = socketToEmail.get(socket);
    // socketToEmail.remove(socket);
    // emailToSocket.remote(email);
  });
})

const PORT = process.env.PORT || 5000

server.listen(PORT, () => {
  console.log('listening on *:', PORT);
});
