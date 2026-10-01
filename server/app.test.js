const { io: connectClient } = require('socket.io-client');
const { createApp, sanitizeAttachment } = require('./app');

const makeFakeLiveKit = (overrides = {}) => ({
  getLiveKitStatus: (req, res) => res.json({ enabled: false, url: null }),
  isLiveKitConfigured: jest.fn(() => false),
  createAccessToken: jest.fn(async () => 'fake-token'),
  removeLiveKitParticipant: jest.fn(async () => {}),
  deleteLiveKitRoom: jest.fn(async () => {}),
  ...overrides,
});

// resolves with the payload of the next `event`, or rejects so a missing
// event fails the test loudly instead of hanging until the jest timeout
const waitFor = (socket, event, timeoutMs = 2000) => new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error(`timed out waiting for "${event}"`)), timeoutMs);
  socket.once(event, (payload) => {
    clearTimeout(timer);
    resolve(payload);
  });
});

// asserts an event does NOT arrive within a window
const expectNoEvent = (socket, event, windowMs = 250) => new Promise((resolve, reject) => {
  const handler = () => reject(new Error(`unexpected "${event}"`));
  socket.once(event, handler);
  setTimeout(() => {
    socket.off(event, handler);
    resolve();
  }, windowMs);
});

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

describe('app (socket.io integration)', () => {
  let ctx;
  let url;
  let clients;
  let livekit;

  const start = async (config = {}, livekitOverrides = {}) => {
    livekit = makeFakeLiveKit(livekitOverrides);
    ctx = createApp({ config: { aloneTimeoutMs: 0, ...config }, livekit });
    await new Promise((resolve) => ctx.server.listen(0, resolve));
    url = `http://localhost:${ctx.server.address().port}`;
  };

  const newClient = async () => {
    const client = connectClient(url, { transports: ['websocket'], forceNew: true, reconnection: false });
    clients.push(client);
    await waitFor(client, 'connect');
    return client;
  };

  const hostRoom = async (host, identity = 'Host', password) => {
    const idPromise = waitFor(host, 'room-id');
    host.emit('create-room', { identity, password });
    const { roomId } = await idPromise;
    return roomId;
  };

  const joinAs = async (client, roomId, identity, password) => {
    const update = waitFor(client, 'room-update');
    client.emit('join-room', { roomId, identity, password });
    return update;
  };

  beforeEach(() => {
    clients = [];
  });

  afterEach(async () => {
    clients.forEach((c) => c.close());
    await ctx.close();
  });

  describe('creating and joining', () => {
    beforeEach(() => start());

    it('creates a room and tells the host its id and membership', async () => {
      const host = await newClient();
      const update = waitFor(host, 'room-update');

      const roomId = await hostRoom(host);

      expect(roomId).toEqual(expect.any(String));
      expect((await update).connectedUsers.map((u) => u.identity)).toEqual(['Host']);
    });

    it('lets a guest join and tells everyone', async () => {
      const host = await newClient();
      const guest = await newClient();
      const roomId = await hostRoom(host);

      const hostSeesUpdate = waitFor(host, 'room-update');
      const { connectedUsers } = await joinAs(guest, roomId, 'Guest');

      expect(connectedUsers.map((u) => u.identity)).toEqual(['Host', 'Guest']);
      expect((await hostSeesUpdate).connectedUsers).toHaveLength(2);
    });

    it('answers a join with no room id instead of leaving the client hanging', async () => {
      const guest = await newClient();
      const reply = waitFor(guest, 'join-error');

      guest.emit('join-room', { roomId: null, identity: 'Guest' });

      expect(await reply).toEqual({ reason: 'not-found' });
    });

    it('answers a join for a room that does not exist', async () => {
      const guest = await newClient();
      const reply = waitFor(guest, 'join-error');

      guest.emit('join-room', { roomId: 'nope', identity: 'Guest' });

      expect(await reply).toEqual({ reason: 'not-found' });
    });

    it('rejects a missing or blank name for both creating and joining', async () => {
      const client = await newClient();

      const first = waitFor(client, 'join-error');
      client.emit('create-room', { identity: '   ' });
      expect(await first).toEqual({ reason: 'invalid-name' });

      const second = waitFor(client, 'join-error');
      client.emit('join-room', { roomId: 'x', identity: undefined });
      expect(await second).toEqual({ reason: 'invalid-name' });
    });

    it('rejects a wrong password and accepts the right one', async () => {
      const host = await newClient();
      const guest = await newClient();
      const roomId = await hostRoom(host, 'Host', 'letmein');

      const denied = waitFor(guest, 'join-error');
      guest.emit('join-room', { roomId, identity: 'Guest', password: 'wrong' });
      expect(await denied).toEqual({ reason: 'invalid-password' });

      const { connectedUsers } = await joinAs(guest, roomId, 'Guest', 'letmein');
      expect(connectedUsers).toHaveLength(2);
    });

    it('enforces the participant limit on the server', async () => {
      const host = await newClient();
      const roomId = await hostRoom(host);
      for (let i = 0; i < 3; i += 1) {
        await joinAs(await newClient(), roomId, `Guest ${i}`);
      }

      const extra = await newClient();
      const reply = waitFor(extra, 'join-error');
      extra.emit('join-room', { roomId, identity: 'Too many' });

      expect(await reply).toEqual({ reason: 'full' });
    });

    it('serves room status over HTTP', async () => {
      const host = await newClient();
      const roomId = await hostRoom(host);

      const res = await fetch(`${url}/api/room-exists/${roomId}`);

      expect(await res.json()).toEqual({ roomExists: true, full: false, passwordProtected: false });
    });
  });

  describe('leaving', () => {
    beforeEach(() => start());

    it('lets a guest leave on purpose without dropping their connection', async () => {
      const host = await newClient();
      const guest = await newClient();
      const roomId = await hostRoom(host);
      await joinAs(guest, roomId, 'Guest');

      const gone = waitFor(host, 'user-disconnected');
      const update = waitFor(host, 'room-update');
      guest.emit('leave-room');

      expect(await gone).toEqual({ socketId: guest.id });
      expect((await update).connectedUsers.map((u) => u.identity)).toEqual(['Host']);
      expect(guest.connected).toBe(true);
    });

    it('frees the seat so a previously-ghosted user count never blocks the room', async () => {
      const host = await newClient();
      const roomId = await hostRoom(host);
      const guests = [];
      for (let i = 0; i < 3; i += 1) {
        const g = await newClient();
        await joinAs(g, roomId, `G${i}`);
        guests.push(g);
      }
      guests.forEach((g) => g.emit('leave-room'));
      await sleep(100);

      const res = await fetch(`${url}/api/room-exists/${roomId}`);

      expect((await res.json()).full).toBe(false);
    });

    it('closes the room and tears down the LiveKit room when the last person leaves', async () => {
      const host = await newClient();
      const roomId = await hostRoom(host);

      host.emit('leave-room');
      await sleep(100);

      expect(livekit.deleteLiveKitRoom).toHaveBeenCalledWith(roomId);
      const res = await fetch(`${url}/api/room-exists/${roomId}`);
      expect(await res.json()).toEqual({ roomExists: false });
    });

    it('can create a new room straight after leaving one on the same connection', async () => {
      const host = await newClient();
      const first = await hostRoom(host);
      host.emit('leave-room');

      const second = await hostRoom(host);

      expect(second).not.toBe(first);
    });

    it('moves a user out of their old room when they join another', async () => {
      const hostA = await newClient();
      const hostB = await newClient();
      const roomA = await hostRoom(hostA, 'A');
      const roomB = await hostRoom(hostB, 'B');
      const mover = await newClient();
      await joinAs(mover, roomA, 'Mover');

      await joinAs(mover, roomB, 'Mover');

      const a = await (await fetch(`${url}/api/room-exists/${roomA}`)).json();
      expect(a.full).toBe(false);
      expect(ctx.store.rooms.find((r) => r.id === roomA).connectedUsers.map((u) => u.identity)).toEqual(['A']);
    });

    it('treats a dropped connection like a leave, and kicks them from LiveKit', async () => {
      const host = await newClient();
      const guest = await newClient();
      const roomId = await hostRoom(host);
      await joinAs(guest, roomId, 'Guest');
      const guestId = guest.id;

      const gone = waitFor(host, 'user-disconnected');
      guest.close();

      expect(await gone).toEqual({ socketId: guestId });
      expect(livekit.removeLiveKitParticipant).toHaveBeenCalledWith(roomId, guestId);
    });
  });

  describe('host moderation', () => {
    beforeEach(() => start());

    it('lets the host remove a guest, who stays connected and can join elsewhere', async () => {
      const host = await newClient();
      const guest = await newClient();
      const roomId = await hostRoom(host);
      await joinAs(guest, roomId, 'Guest');

      const removed = waitFor(guest, 'removed-from-room');
      host.emit('remove-participant', { roomId, targetSocketId: guest.id });
      await removed;
      await sleep(100);

      expect(guest.connected).toBe(true);
      expect(livekit.removeLiveKitParticipant).toHaveBeenCalledWith(roomId, guest.id);

      const otherHost = await newClient();
      const otherRoom = await hostRoom(otherHost, 'Other');
      const { connectedUsers } = await joinAs(guest, otherRoom, 'Guest');
      expect(connectedUsers).toHaveLength(2);
    });

    it('ignores a removal request from someone who is not the host', async () => {
      const host = await newClient();
      const guest = await newClient();
      const other = await newClient();
      const roomId = await hostRoom(host);
      await joinAs(guest, roomId, 'Guest');
      await joinAs(other, roomId, 'Other');

      const noRemoval = expectNoEvent(other, 'removed-from-room');
      guest.emit('remove-participant', { roomId, targetSocketId: other.id });
      await noRemoval;

      expect(ctx.store.rooms[0].connectedUsers).toHaveLength(3);
    });

    it('ignores removing someone who is not in the room, and removing yourself', async () => {
      const host = await newClient();
      const outsider = await newClient();
      const roomId = await hostRoom(host);

      host.emit('remove-participant', { roomId, targetSocketId: outsider.id });
      host.emit('remove-participant', { roomId, targetSocketId: host.id });
      await sleep(100);

      expect(ctx.store.rooms[0].connectedUsers).toHaveLength(1);
    });
  });

  describe('chat and captions', () => {
    beforeEach(() => start());

    it('relays a message to the other members but not back to the sender', async () => {
      const host = await newClient();
      const guest = await newClient();
      const roomId = await hostRoom(host);
      await joinAs(guest, roomId, 'Guest');

      const received = waitFor(host, 'receive-message');
      const echoed = expectNoEvent(guest, 'receive-message');
      guest.emit('send-message', { roomId, message: { message: 'hello', messageId: 'm1' } });

      expect(await received).toEqual({ message: 'hello', messageId: 'm1', attachment: null, socketId: guest.id });
      await echoed;
    });

    it('does not let a non-member post into a room they only know the id of', async () => {
      const host = await newClient();
      const outsider = await newClient();
      const roomId = await hostRoom(host);

      const nothing = expectNoEvent(host, 'receive-message');
      outsider.emit('send-message', { roomId, message: { message: 'spam', messageId: 'x' } });
      await nothing;
    });

    it('truncates an oversized message', async () => {
      const host = await newClient();
      const guest = await newClient();
      const roomId = await hostRoom(host);
      await joinAs(guest, roomId, 'Guest');

      const received = waitFor(host, 'receive-message');
      guest.emit('send-message', { roomId, message: { message: 'a'.repeat(50000), messageId: 'big' } });

      expect((await received).message).toHaveLength(2000);
    });

    it('strips a javascript: attachment URL instead of relaying it', async () => {
      const host = await newClient();
      const guest = await newClient();
      const roomId = await hostRoom(host);
      await joinAs(guest, roomId, 'Guest');

      const received = waitFor(host, 'receive-message');
      guest.emit('send-message', {
        roomId,
        message: { message: 'look', messageId: 'evil', attachment: { url: 'javascript:alert(1)', name: 'x', type: 'image/png', size: 1 } },
      });

      expect((await received).attachment).toBeNull();
    });

    it('drops a message that has neither text nor a valid attachment', async () => {
      const host = await newClient();
      const guest = await newClient();
      const roomId = await hostRoom(host);
      await joinAs(guest, roomId, 'Guest');

      const nothing = expectNoEvent(host, 'receive-message');
      guest.emit('send-message', { roomId, message: { message: '', messageId: 'empty', attachment: { url: 'javascript:1' } } });
      await nothing;
    });

    it('relays captions between members only', async () => {
      const host = await newClient();
      const guest = await newClient();
      const outsider = await newClient();
      const roomId = await hostRoom(host);
      await joinAs(guest, roomId, 'Guest');

      const got = waitFor(host, 'receive-caption');
      guest.emit('send-caption', { roomId, text: 'hi there' });
      expect(await got).toEqual({ text: 'hi there', socketId: guest.id });

      const nothing = expectNoEvent(host, 'receive-caption');
      outsider.emit('send-caption', { roomId, text: 'sneaky' });
      await nothing;
    });
  });

  describe('camera state', () => {
    beforeEach(() => start());

    it('tells everyone else in the room when someone turns their camera off or on', async () => {
      const host = await newClient();
      const guest = await newClient();
      const roomId = await hostRoom(host);
      await joinAs(guest, roomId, 'Guest');

      const off = waitFor(host, 'media-state');
      guest.emit('media-state', { video: false });
      expect(await off).toEqual({ socketId: guest.id, video: false });

      const on = waitFor(host, 'media-state');
      guest.emit('media-state', { video: true });
      expect(await on).toEqual({ socketId: guest.id, video: true });
    });

    it('does not echo it back to the sender', async () => {
      const host = await newClient();
      const roomId = await hostRoom(host);

      const nothing = expectNoEvent(host, 'media-state');
      host.emit('media-state', { video: false });
      await nothing;
      expect(roomId).toBeDefined();
    });

    it('only reaches the sender\'s own room', async () => {
      const hostA = await newClient();
      const hostB = await newClient();
      const roomA = await hostRoom(hostA, 'A');
      await hostRoom(hostB, 'B');
      const guestA = await newClient();
      await joinAs(guestA, roomA, 'GuestA');

      const nothing = expectNoEvent(hostB, 'media-state');
      guestA.emit('media-state', { video: false });
      await nothing;
    });

    it('ignores someone who is not in a room', async () => {
      const host = await newClient();
      const roomId = await hostRoom(host);
      const outsider = await newClient();

      const nothing = expectNoEvent(host, 'media-state');
      outsider.emit('media-state', { video: false });
      await nothing;
      expect(roomId).toBeDefined();
    });

    it('treats a malformed payload as "off" rather than crashing', async () => {
      const host = await newClient();
      const guest = await newClient();
      const roomId = await hostRoom(host);
      await joinAs(guest, roomId, 'Guest');

      const got = waitFor(host, 'media-state');
      guest.emit('media-state', undefined);

      expect(await got).toEqual({ socketId: guest.id, video: false });
    });
  });

  describe('peer signalling (mesh fallback)', () => {
    beforeEach(() => start());

    it('relays a signal between two members of the same room', async () => {
      const host = await newClient();
      const guest = await newClient();
      const roomId = await hostRoom(host);
      await joinAs(guest, roomId, 'Guest');

      const got = waitFor(guest, 'conn-signal');
      host.emit('conn-signal', { signal: { sdp: 'x' }, connUserSocketId: guest.id });

      expect(await got).toEqual({ signal: { sdp: 'x' }, connUserSocketId: host.id });
    });

    it('refuses to relay a signal to someone in a different room', async () => {
      const hostA = await newClient();
      const hostB = await newClient();
      await hostRoom(hostA, 'A');
      await hostRoom(hostB, 'B');

      const nothing = expectNoEvent(hostB, 'conn-signal');
      hostA.emit('conn-signal', { signal: {}, connUserSocketId: hostB.id });
      await nothing;
    });
  });

  describe('LiveKit tokens', () => {
    beforeEach(() => start({}, { isLiveKitConfigured: jest.fn(() => true) }));

    const requestToken = (client) => new Promise((resolve) => client.emit('livekit-token', {}, resolve));

    it('issues a token bound to the caller\'s own socket id and the room the server knows', async () => {
      process.env.LIVEKIT_URL = 'wss://example.livekit.cloud';
      const host = await newClient();
      const roomId = await hostRoom(host, 'Alice');

      const reply = await requestToken(host);

      expect(reply).toEqual({ token: 'fake-token', url: 'wss://example.livekit.cloud' });
      expect(livekit.createAccessToken).toHaveBeenCalledWith({ roomId, identity: host.id, name: 'Alice' });
    });

    it('ignores any room or identity the client tries to supply', async () => {
      const host = await newClient();
      const victim = await newClient();
      const roomId = await hostRoom(host, 'Alice');
      await hostRoom(victim, 'Victim');

      await new Promise((resolve) => host.emit('livekit-token', { roomId: 'other', identity: victim.id, socketId: victim.id }, resolve));

      expect(livekit.createAccessToken).toHaveBeenCalledWith({ roomId, identity: host.id, name: 'Alice' });
    });

    it('refuses a token to a socket that has not joined a room', async () => {
      const stranger = await newClient();

      expect(await requestToken(stranger)).toEqual({ error: 'not-in-room' });
      expect(livekit.createAccessToken).not.toHaveBeenCalled();
    });

    it('reports a failure to mint instead of hanging', async () => {
      livekit.createAccessToken.mockRejectedValueOnce(new Error('boom'));
      jest.spyOn(console, 'error').mockImplementation(() => {});
      const host = await newClient();
      await hostRoom(host);

      expect(await requestToken(host)).toEqual({ error: 'token-failed' });
      console.error.mockRestore();
    });
  });

  describe('LiveKit not configured', () => {
    beforeEach(() => start());

    it('tells the client so', async () => {
      const host = await newClient();
      await hostRoom(host);

      const reply = await new Promise((resolve) => host.emit('livekit-token', {}, resolve));

      expect(reply).toEqual({ error: 'not-configured' });
    });
  });

  describe('idle timeout (one person left alone)', () => {
    beforeEach(() => start({ aloneTimeoutMs: 600, warnBeforeMs: 300 }));

    it('warns the lone participant, then ends the room and the LiveKit session', async () => {
      const host = await newClient();
      const roomId = await hostRoom(host);

      const warning = await waitFor(host, 'room-idle-warning');
      expect(warning.secondsLeft).toBeGreaterThanOrEqual(0);

      await waitFor(host, 'room-idle-timeout');
      await sleep(50);

      expect(livekit.deleteLiveKitRoom).toHaveBeenCalledWith(roomId);
      expect(await (await fetch(`${url}/api/room-exists/${roomId}`)).json()).toEqual({ roomExists: false });
      expect(host.connected).toBe(true); // still able to start another room
    });

    it('does not end a room that has two people in it', async () => {
      const host = await newClient();
      const guest = await newClient();
      const roomId = await hostRoom(host);
      await joinAs(guest, roomId, 'Guest');

      await sleep(900);

      expect(await (await fetch(`${url}/api/room-exists/${roomId}`)).json()).toMatchObject({ roomExists: true });
    });

    it('starts counting again when a guest leaves and the host is alone', async () => {
      const host = await newClient();
      const guest = await newClient();
      const roomId = await hostRoom(host);
      await joinAs(guest, roomId, 'Guest');
      guest.emit('leave-room');

      await waitFor(host, 'room-idle-timeout', 2000);

      expect(await (await fetch(`${url}/api/room-exists/${roomId}`)).json()).toEqual({ roomExists: false });
    });

    it('can be kept open by the lone participant', async () => {
      const host = await newClient();
      const roomId = await hostRoom(host);

      await waitFor(host, 'room-idle-warning');
      host.emit('extend-room');
      await sleep(350); // past where the original timeout would have fired

      expect(await (await fetch(`${url}/api/room-exists/${roomId}`)).json()).toMatchObject({ roomExists: true });
    });

    it('stops the countdown when the room closes by itself', async () => {
      const host = await newClient();
      const roomId = await hostRoom(host);
      expect(ctx.idle.isPending(roomId)).toBe(true);
      host.emit('leave-room');
      await sleep(50);

      expect(ctx.idle.isPending(roomId)).toBe(false);
      await expectNoEvent(host, 'room-idle-timeout', 800);
    });
  });
});

describe('sanitizeAttachment', () => {
  it('keeps a well-formed https attachment', () => {
    expect(sanitizeAttachment({ url: 'https://cdn.example.com/a.png', name: 'a.png', size: 5, type: 'image/png' }))
      .toEqual({ url: 'https://cdn.example.com/a.png', name: 'a.png', size: 5, type: 'image/png' });
  });

  it.each([
    ['javascript:alert(1)'],
    ['data:text/html,<script>alert(1)</script>'],
    ['file:///etc/passwd'],
    ['not a url'],
    [undefined],
  ])('rejects %s', (url) => {
    expect(sanitizeAttachment({ url })).toBeNull();
  });

  it('rejects non-objects', () => {
    expect(sanitizeAttachment(null)).toBeNull();
    expect(sanitizeAttachment('https://x.com')).toBeNull();
  });

  it('only passes through known fields', () => {
    const clean = sanitizeAttachment({ url: 'https://x.com/a', name: 'a', size: 1, type: 'x/y', onclick: 'evil()' });
    expect(Object.keys(clean).sort()).toEqual(['name', 'size', 'type', 'url']);
  });
});
