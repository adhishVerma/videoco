const { createStore, createRoom } = require('../rooms');

const makeRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe('livekit', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    delete process.env.LIVEKIT_API_KEY;
    delete process.env.LIVEKIT_API_SECRET;
    delete process.env.LIVEKIT_URL;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('getLiveKitStatus', () => {
    it('reports disabled when env vars are not set', () => {
      const { getLiveKitStatus } = require('./livekit');
      const res = makeRes();

      getLiveKitStatus({}, res);

      expect(res.json).toHaveBeenCalledWith({ enabled: false, url: null });
    });

    it('reports enabled with the configured URL once all env vars are set', () => {
      process.env.LIVEKIT_API_KEY = 'key';
      process.env.LIVEKIT_API_SECRET = 'secret';
      process.env.LIVEKIT_URL = 'wss://example.livekit.cloud';

      const { getLiveKitStatus } = require('./livekit');
      const res = makeRes();

      getLiveKitStatus({}, res);

      expect(res.json).toHaveBeenCalledWith({ enabled: true, url: 'wss://example.livekit.cloud' });
    });
  });

  describe('createGetTokenHandler', () => {
    it('returns 501 when LiveKit is not configured', async () => {
      const { createGetTokenHandler } = require('./livekit');
      const roomsStore = require('../rooms');
      const store = roomsStore.createStore();
      const handler = createGetTokenHandler(roomsStore, store);
      const res = makeRes();

      await handler({ body: { roomId: 'r1', identity: 'alice', socketId: 's1' } }, res);

      expect(res.status).toHaveBeenCalledWith(501);
    });

    it('validates required fields once configured', async () => {
      process.env.LIVEKIT_API_KEY = 'key';
      process.env.LIVEKIT_API_SECRET = 'secret';
      process.env.LIVEKIT_URL = 'wss://example.livekit.cloud';

      const { createGetTokenHandler } = require('./livekit');
      const roomsStore = require('../rooms');
      const store = roomsStore.createStore();
      const handler = createGetTokenHandler(roomsStore, store);
      const res = makeRes();

      await handler({ body: {} }, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('rejects a token request for a room that does not exist', async () => {
      process.env.LIVEKIT_API_KEY = 'key';
      process.env.LIVEKIT_API_SECRET = 'secret';
      process.env.LIVEKIT_URL = 'wss://example.livekit.cloud';

      const { createGetTokenHandler } = require('./livekit');
      const roomsStore = require('../rooms');
      const store = roomsStore.createStore();
      const handler = createGetTokenHandler(roomsStore, store);
      const res = makeRes();

      await handler({ body: { roomId: 'missing', identity: 'alice', socketId: 's1' } }, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('rejects a wrong password for a protected room', async () => {
      process.env.LIVEKIT_API_KEY = 'key';
      process.env.LIVEKIT_API_SECRET = 'secret';
      process.env.LIVEKIT_URL = 'wss://example.livekit.cloud';

      const { createGetTokenHandler } = require('./livekit');
      const roomsStore = require('../rooms');
      const store = roomsStore.createStore();
      const { roomId } = await createRoom(store, 'host', 'socket-1', 'letmein');
      const handler = createGetTokenHandler(roomsStore, store);
      const res = makeRes();

      await handler({ body: { roomId, identity: 'guest', socketId: 's2', password: 'wrong' } }, res);

      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('issues a token for a valid room and correct password', async () => {
      process.env.LIVEKIT_API_KEY = 'key';
      process.env.LIVEKIT_API_SECRET = 'secret';
      process.env.LIVEKIT_URL = 'wss://example.livekit.cloud';

      const { createGetTokenHandler } = require('./livekit');
      const roomsStore = require('../rooms');
      const store = roomsStore.createStore();
      const { roomId } = await createRoom(store, 'host', 'socket-1', 'letmein');
      const handler = createGetTokenHandler(roomsStore, store);
      const res = makeRes();

      await handler({ body: { roomId, identity: 'guest', socketId: 's2', password: 'letmein' } }, res);

      expect(res.status).toHaveBeenCalledWith(200);
      const payload = res.json.mock.calls[0][0];
      expect(typeof payload.token).toBe('string');
      expect(payload.token.split('.')).toHaveLength(3); // a JWT
      expect(payload.url).toBe('wss://example.livekit.cloud');
    });

    it('issues a token for an unprotected room with no password given', async () => {
      process.env.LIVEKIT_API_KEY = 'key';
      process.env.LIVEKIT_API_SECRET = 'secret';
      process.env.LIVEKIT_URL = 'wss://example.livekit.cloud';

      const { createGetTokenHandler } = require('./livekit');
      const roomsStore = require('../rooms');
      const store = roomsStore.createStore();
      const { roomId } = await createRoom(store, 'host', 'socket-1');
      const handler = createGetTokenHandler(roomsStore, store);
      const res = makeRes();

      await handler({ body: { roomId, identity: 'guest', socketId: 's2' } }, res);

      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe('removeLiveKitParticipant', () => {
    it('does nothing when LiveKit is not configured', async () => {
      const { removeLiveKitParticipant } = require('./livekit');

      await expect(removeLiveKitParticipant('room-1', 'socket-2')).resolves.toBeUndefined();
    });

    it('calls RoomServiceClient.removeParticipant with the room and participant identity', async () => {
      process.env.LIVEKIT_API_KEY = 'key';
      process.env.LIVEKIT_API_SECRET = 'secret';
      process.env.LIVEKIT_URL = 'wss://example.livekit.cloud';

      const removeParticipant = jest.fn().mockResolvedValue(undefined);
      jest.doMock('livekit-server-sdk', () => ({
        AccessToken: jest.requireActual('livekit-server-sdk').AccessToken,
        RoomServiceClient: jest.fn().mockImplementation(() => ({ removeParticipant })),
      }));

      const { removeLiveKitParticipant } = require('./livekit');
      await removeLiveKitParticipant('room-1', 'socket-2');

      expect(removeParticipant).toHaveBeenCalledWith('room-1', 'socket-2');
    });

    it('swallows an error from LiveKit instead of throwing', async () => {
      process.env.LIVEKIT_API_KEY = 'key';
      process.env.LIVEKIT_API_SECRET = 'secret';
      process.env.LIVEKIT_URL = 'wss://example.livekit.cloud';

      jest.doMock('livekit-server-sdk', () => ({
        AccessToken: jest.requireActual('livekit-server-sdk').AccessToken,
        RoomServiceClient: jest.fn().mockImplementation(() => ({
          removeParticipant: jest.fn().mockRejectedValue(new Error('not found')),
        })),
      }));
      jest.spyOn(console, 'error').mockImplementation(() => {});

      const { removeLiveKitParticipant } = require('./livekit');

      await expect(removeLiveKitParticipant('room-1', 'socket-2')).resolves.toBeUndefined();
    });
  });
});
