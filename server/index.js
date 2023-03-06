const express = require('express');
const http = require('http');
const {Server} = require('socket.io')

const app = express()
const server = http.createServer(app);
const io = new Server(server, { cors : true });

const emailToSocket = new Map();

// when client connects
io.on('connection', socket => {
  console.log('user connected', socket.id)

  // when socket wants to join a room
  socket.on('join-room', (data) => {
    const { emailId, roomId } = data;
    // socket is moved to roomId
    socket.join(roomId);
    socket.emit('joined-room', { roomId })
    console.log('User : ', emailId, ' to room :', roomId )
    socket.broadcast.to(roomId).emit('user-joined', { emailId });
  })


  // passing new ice candidates
  socket.on('new-ice-candidate', (data) => {
    const { candidate, roomId } = data;
    socket.broadcast.to(roomId).emit('new-ice-candidate', { candidate })
  })

  //  on video-offer
  socket.on('video-offer', (data) => {
    const { roomId, offer} = data;
    socket.broadcast.to(roomId).emit('video-offer', { offer })
  })

  // on video-answer
  socket.on('video-answer', (data) => {
    const  { roomId, answer } = data;
    socket.broadcast.to(roomId).emit('video-answer', { answer })
  })

  // user disconnect
  socket.on('disconnect', () => {
    console.log(`user disconnected: ${socket.id}`);
});

})


const PORT = 5000 || process.env.PORT

server.listen(PORT, () => console.log(`server running on ${PORT}`))