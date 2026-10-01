const express = require('express');
const http = require('http');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const { Server } = require('socket.io');
const { getIce } = require('./controllers/getIce');
const { getAttachmentsStatus, getUploadUrl } = require('./controllers/attachments');
const roomsStore = require('./rooms');
const { createIdleWatcher } = require('./idle');

const MAX_MESSAGE_LENGTH = 2000;
const MAX_IDENTITY_LENGTH = 50;
const MAX_PASSWORD_LENGTH = 128; // also bounds scrypt work per request

const toInt = (value, fallback) => {
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
};

const cleanIdentity = (identity) => {
  if (typeof identity !== 'string') return null;
  const trimmed = identity.trim().slice(0, MAX_IDENTITY_LENGTH);
  return trimmed.length > 0 ? trimmed : null;
};

const cleanPassword = (password) => {
  return typeof password === 'string' && password.length > 0 ? password.slice(0, MAX_PASSWORD_LENGTH) : undefined;
};

const isHttpUrl = (value) => {
  try {
    const { protocol } = new URL(value);
    return protocol === 'https:' || protocol === 'http:';
  } catch (err) {
    return false;
  }
};

// The attachment object comes straight from another client and ends up as an
// <a href>/<img src> in everyone else's browser - a "javascript:" URL there is
// stored XSS. Rebuild it from known-good fields instead of relaying it as-is.
const sanitizeAttachment = (attachment) => {
  if (!attachment || typeof attachment !== 'object') return null;
  if (typeof attachment.url !== 'string' || !isHttpUrl(attachment.url)) return null;
  return {
    url: attachment.url,
    name: String(attachment.name || 'file').slice(0, 200),
    size: Number.isFinite(attachment.size) ? attachment.size : 0,
    type: String(attachment.type || '').slice(0, 100),
  };
};

const createApp = (overrides = {}) => {
  const config = {
    allowedOrigins: (process.env.CLIENT_URL || 'http://localhost:3000').split(',').map((origin) => origin.trim()),
    // A room with exactly one person in it is ended after this long (0 disables).
    aloneTimeoutMs: toInt(process.env.ROOM_ALONE_TIMEOUT_MS, 10 * 60 * 1000),
    // ...with a warning (and a chance to keep it open) this long before.
    warnBeforeMs: toInt(process.env.ROOM_ALONE_WARNING_MS, 60 * 1000),
    ...overrides.config,
  };
  const livekit = overrides.livekit || require('./controllers/livekit');

  const corsOptions = { origin: config.allowedOrigins, methods: ['GET', 'POST'] };

  const app = express();
  const server = http.createServer(app);
  const io = new Server(server, {
    cors: corsOptions,
    // Notice dead connections in ~20s instead of ~45s so abandoned
    // participants (and their LiveKit sessions) are cleaned up sooner.
    pingInterval: 10000,
    pingTimeout: 10000,
  });

  app.use(cors(corsOptions));
  app.use(express.json());

  const store = roomsStore.createStore();

  const iceLimiter = rateLimit({ windowMs: 60 * 1000, limit: 10, standardHeaders: true, legacyHeaders: false });
  const roomLookupLimiter = rateLimit({ windowMs: 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false });
  const uploadLimiter = rateLimit({ windowMs: 60 * 1000, limit: 20, standardHeaders: true, legacyHeaders: false });

  app.get('/ice', iceLimiter, getIce);
  app.get('/api/room-exists/:roomId', roomLookupLimiter, (req, res) => {
    return res.send(roomsStore.getRoomStatus(store, req.params.roomId));
  });
  app.get('/api/attachments-status', getAttachmentsStatus);
  app.post('/api/upload-url', uploadLimiter, getUploadUrl);
  app.get('/api/livekit-status', livekit.getLiveKitStatus);

  // ---------------------------------------------------------------- helpers

  // The ONE place a socket leaves a room, whether it left on purpose, was
  // removed by the host, timed out, or just dropped. Everything that has to
  // happen on departure lives here so no exit path can forget a step.
  const removeSocketFromRoom = (socketId) => {
    const result = roomsStore.disconnectUser(store, socketId);
    if (!result || !result.room) return null;
    const { room, roomClosed } = result;

    const socket = io.sockets.sockets.get(socketId);
    if (socket) socket.leave(room.id);

    io.to(room.id).emit('user-disconnected', { socketId });

    if (roomClosed) {
      idle.clear(room.id);
      livekit.deleteLiveKitRoom(room.id);
    } else {
      io.to(room.id).emit('room-update', { connectedUsers: room.connectedUsers });
      idle.refresh(room.id);
      // their LiveKit session is independent of the socket - end it too
      livekit.removeLiveKitParticipant(room.id, socketId);
    }
    return room;
  };

  const idle = createIdleWatcher({
    aloneTimeoutMs: config.aloneTimeoutMs,
    warnBeforeMs: config.warnBeforeMs,
    getUserCount: (roomId) => roomsStore.getRoomUserCount(store, roomId),
    onWarn: (roomId, msLeft) => {
      const room = store.rooms.find((r) => r.id === roomId);
      const lone = room && room.connectedUsers[0];
      if (lone) io.to(lone.socketId).emit('room-idle-warning', { secondsLeft: Math.round(msLeft / 1000) });
    },
    onTimeout: (roomId) => {
      const room = store.rooms.find((r) => r.id === roomId);
      const lone = room && room.connectedUsers[0];
      if (!lone) return;
      io.to(lone.socketId).emit('room-idle-timeout');
      removeSocketFromRoom(lone.socketId);
    },
  });

  const sameRoom = (socketIdA, socketIdB) => {
    const a = roomsStore.getUserBySocketId(store, socketIdA);
    const b = roomsStore.getUserBySocketId(store, socketIdB);
    return !!a && !!b && a.roomId === b.roomId;
  };

  // ---------------------------------------------------------------- sockets

  io.on('connection', (socket) => {
    socket.on('create-room', async (data) => {
      try {
        const { identity, password } = data || {};
        const name = cleanIdentity(identity);
        if (!name) return socket.emit('join-error', { reason: 'invalid-name' });

        removeSocketFromRoom(socket.id);
        const { roomId, room } = await roomsStore.createRoom(store, name, socket.id, cleanPassword(password));

        if (socket.disconnected) {
          removeSocketFromRoom(socket.id);
          return;
        }
        socket.join(roomId);
        socket.emit('room-id', { roomId });
        socket.emit('room-update', { connectedUsers: room.connectedUsers });
        idle.refresh(roomId);
      } catch (err) {
        console.error('create-room failed', err);
      }
    });

    socket.on('join-room', async (data) => {
      try {
        const { roomId, identity, password } = data || {};
        const name = cleanIdentity(identity);
        if (!name) return socket.emit('join-error', { reason: 'invalid-name' });
        // A missing roomId used to be silently dropped, which left the client
        // waiting forever for a reply that never came. Always answer.
        if (typeof roomId !== 'string' || !roomId) return socket.emit('join-error', { reason: 'not-found' });

        removeSocketFromRoom(socket.id);
        const result = await roomsStore.joinRoom(store, roomId, name, socket.id, cleanPassword(password));
        if (result.error) return socket.emit('join-error', { reason: result.error });

        if (socket.disconnected) {
          removeSocketFromRoom(socket.id);
          return;
        }
        const { room } = result;
        socket.join(roomId);
        socket.broadcast.to(roomId).emit('prepare-webRTC', { connUserSocketId: socket.id });
        io.to(roomId).emit('room-update', { connectedUsers: room.connectedUsers });
        idle.refresh(roomId); // a second person arriving cancels any countdown
      } catch (err) {
        console.error('join-room failed', err);
      }
    });

    socket.on('leave-room', () => {
      removeSocketFromRoom(socket.id);
    });

    // peer-to-peer mesh signalling - only relay between members of one room
    socket.on('conn-signal', (data) => {
      const { signal, connUserSocketId } = data || {};
      if (!connUserSocketId || !sameRoom(socket.id, connUserSocketId)) return;
      socket.to(connUserSocketId).emit('conn-signal', { signal, connUserSocketId: socket.id });
    });

    socket.on('conn-init', (data) => {
      const { connUserSocketId } = data || {};
      if (!connUserSocketId || !sameRoom(socket.id, connUserSocketId)) return;
      io.to(connUserSocketId).emit('conn-init', { connUserSocketId: socket.id });
    });

    socket.on('send-message', (data) => {
      const { roomId } = data || {};
      // anyone can emit to any room id they know - only members may speak in it
      if (!roomsStore.isMember(store, roomId, socket.id)) return;
      const payload = (data && data.message) || {};
      const message = typeof payload.message === 'string' ? payload.message.slice(0, MAX_MESSAGE_LENGTH) : '';
      const attachment = sanitizeAttachment(payload.attachment);
      if (!message && !attachment) return;
      const messageId = typeof payload.messageId === 'string' ? payload.messageId.slice(0, 100) : String(Date.now());
      socket.broadcast.to(roomId).emit('receive-message', { message, messageId, attachment, socketId: socket.id });
    });

    socket.on('send-caption', (data) => {
      const { roomId, text } = data || {};
      if (!roomsStore.isMember(store, roomId, socket.id) || typeof text !== 'string') return;
      socket.broadcast.to(roomId).emit('receive-caption', { text: text.slice(0, 500), socketId: socket.id });
    });

    // Camera on/off, relayed so other people's tiles can show an avatar. On
    // the peer-to-peer mesh a switched-off camera just sends black frames, so
    // nothing else tells the other side it's off. The room comes from the
    // server's own record, not from the client.
    socket.on('media-state', (data) => {
      const user = roomsStore.getUserBySocketId(store, socket.id);
      if (!user) return;
      socket.broadcast.to(user.roomId).emit('media-state', { socketId: socket.id, video: !!(data && data.video) });
    });

    // the lone participant answering the idle warning with "keep it open"
    socket.on('extend-room', () => {
      const user = roomsStore.getUserBySocketId(store, socket.id);
      if (user) idle.extend(user.roomId);
    });

    // Host moderation. Authorization is against the server's own record of who
    // created the room, never the client's self-reported isRoomHost flag.
    // Deliberately does NOT disconnect the target's socket: that socket is the
    // user's only connection to this server, so killing it would leave them
    // unable to create or join anything else until they reload the page.
    socket.on('remove-participant', (data) => {
      const { roomId, targetSocketId } = data || {};
      if (!roomId || !targetSocketId || targetSocketId === socket.id) return;
      if (!roomsStore.isRoomHost(store, roomId, socket.id)) return;
      if (!roomsStore.isMember(store, roomId, targetSocketId)) return;

      io.to(targetSocketId).emit('removed-from-room');
      removeSocketFromRoom(targetSocketId);
    });

    // LiveKit access token, bound to this socket's own id and the room the
    // SERVER knows it joined - the client supplies neither.
    socket.on('livekit-token', async (data, ack) => {
      const reply = typeof ack === 'function' ? ack : () => {};
      if (!livekit.isLiveKitConfigured()) return reply({ error: 'not-configured' });
      const user = roomsStore.getUserBySocketId(store, socket.id);
      if (!user) return reply({ error: 'not-in-room' });
      try {
        const token = await livekit.createAccessToken({ roomId: user.roomId, identity: socket.id, name: user.identity });
        reply({ token, url: process.env.LIVEKIT_URL });
      } catch (err) {
        console.error('failed to create LiveKit token', err);
        reply({ error: 'token-failed' });
      }
    });

    socket.on('disconnect', () => {
      removeSocketFromRoom(socket.id);
    });
  });

  const close = () => new Promise((resolve) => {
    idle.stopAll();
    io.close(() => resolve());
  });

  return { app, server, io, store, idle, config, close };
};

module.exports = { createApp, sanitizeAttachment, cleanIdentity };
