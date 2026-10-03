const configure = () => {
  process.env.LIVEKIT_API_KEY = 'key';
  process.env.LIVEKIT_API_SECRET = 'secret';
  process.env.LIVEKIT_URL = 'wss://example.livekit.cloud';
};

const makeRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const decodeJwt = (token) => JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());

describe('livekit', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    delete process.env.LIVEKIT_API_KEY;
    delete process.env.LIVEKIT_API_SECRET;
    delete process.env.LIVEKIT_URL;
  });

  afterEach(() => {
    jest.restoreAllMocks();
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
      configure();
      const { getLiveKitStatus } = require('./livekit');
      const res = makeRes();

      getLiveKitStatus({}, res);

      expect(res.json).toHaveBeenCalledWith({ enabled: true, url: 'wss://example.livekit.cloud' });
    });
  });

  describe('createAccessToken', () => {
    it('mints a JWT bound to the given room and identity', async () => {
      configure();
      const { createAccessToken } = require('./livekit');

      const token = await createAccessToken({ roomId: 'room-1', identity: 'socket-9', name: 'Alice' });

      expect(token.split('.')).toHaveLength(3);
      const claims = decodeJwt(token);
      expect(claims.sub).toBe('socket-9');
      expect(claims.name).toBe('Alice');
      expect(claims.video).toMatchObject({ room: 'room-1', roomJoin: true, canPublish: true, canSubscribe: true });
    });

    it('expires quickly - it is only needed to join, not to stay', async () => {
      configure();
      const { createAccessToken } = require('./livekit');

      const claims = decodeJwt(await createAccessToken({ roomId: 'r', identity: 'i', name: 'n' }));

      expect(claims.exp - claims.nbf).toBeLessThanOrEqual(10 * 60);
    });
  });

  describe('removeLiveKitParticipant', () => {
    it('does nothing when LiveKit is not configured', async () => {
      const { removeLiveKitParticipant } = require('./livekit');

      await expect(removeLiveKitParticipant('room-1', 'socket-2')).resolves.toBeUndefined();
    });

    it('calls RoomServiceClient.removeParticipant with the room and participant identity', async () => {
      configure();
      const removeParticipant = jest.fn().mockResolvedValue(undefined);
      jest.doMock('livekit-server-sdk', () => ({
        AccessToken: jest.requireActual('livekit-server-sdk').AccessToken,
        RoomServiceClient: jest.fn().mockImplementation(() => ({ removeParticipant })),
      }));

      const { removeLiveKitParticipant } = require('./livekit');
      await removeLiveKitParticipant('room-1', 'socket-2');

      expect(removeParticipant).toHaveBeenCalledWith('room-1', 'socket-2');
    });

    it('swallows an unexpected error and logs it', async () => {
      configure();
      jest.doMock('livekit-server-sdk', () => ({
        AccessToken: jest.requireActual('livekit-server-sdk').AccessToken,
        RoomServiceClient: jest.fn().mockImplementation(() => ({
          removeParticipant: jest.fn().mockRejectedValue(new Error('boom')),
        })),
      }));
      const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      const { removeLiveKitParticipant } = require('./livekit');

      await expect(removeLiveKitParticipant('room-1', 'socket-2')).resolves.toBeUndefined();
      expect(errorSpy).toHaveBeenCalled();
    });

    it('stays quiet when the participant was simply already gone', async () => {
      configure();
      jest.doMock('livekit-server-sdk', () => ({
        AccessToken: jest.requireActual('livekit-server-sdk').AccessToken,
        RoomServiceClient: jest.fn().mockImplementation(() => ({
          removeParticipant: jest.fn().mockRejectedValue(Object.assign(new Error('participant does not exist'), { status: 404 })),
        })),
      }));
      const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      const { removeLiveKitParticipant } = require('./livekit');
      await removeLiveKitParticipant('room-1', 'socket-2');

      expect(errorSpy).not.toHaveBeenCalled();
    });
  });

  describe('deleteLiveKitRoom', () => {
    it('does nothing when LiveKit is not configured', async () => {
      const { deleteLiveKitRoom } = require('./livekit');

      await expect(deleteLiveKitRoom('room-1')).resolves.toBeUndefined();
    });

    it('deletes the SFU room so nothing keeps running after ours closes', async () => {
      configure();
      const deleteRoom = jest.fn().mockResolvedValue(undefined);
      jest.doMock('livekit-server-sdk', () => ({
        AccessToken: jest.requireActual('livekit-server-sdk').AccessToken,
        RoomServiceClient: jest.fn().mockImplementation(() => ({ deleteRoom })),
      }));

      const { deleteLiveKitRoom } = require('./livekit');
      await deleteLiveKitRoom('room-1');

      expect(deleteRoom).toHaveBeenCalledWith('room-1');
    });

    it('never throws if LiveKit is unreachable', async () => {
      configure();
      jest.doMock('livekit-server-sdk', () => ({
        AccessToken: jest.requireActual('livekit-server-sdk').AccessToken,
        RoomServiceClient: jest.fn().mockImplementation(() => ({
          deleteRoom: jest.fn().mockRejectedValue(new Error('ECONNREFUSED')),
        })),
      }));
      jest.spyOn(console, 'error').mockImplementation(() => {});

      const { deleteLiveKitRoom } = require('./livekit');

      await expect(deleteLiveKitRoom('room-1')).resolves.toBeUndefined();
    });
  });
});
