const { getIce } = require('./getIce');

const makeRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe('getIce', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    delete process.env.TURN_SERVER_URL;
    delete process.env.TURN_SECRET;
    delete process.env.TWILIO_ACCOUNT_SID;
    delete process.env.TWILIO_AUTH_TOKEN;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('returns self-hosted TURN credentials when configured, without calling Twilio', async () => {
    process.env.TURN_SERVER_URL = 'turn.example.com';
    process.env.TURN_SECRET = 'super-secret';

    const res = makeRes();
    await getIce({}, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const servers = res.json.mock.calls[0][0];
    expect(servers).toHaveLength(4);
    expect(servers[0]).toEqual({ urls: 'stun:turn.example.com' });

    const turnServer = servers.find((s) => s.urls === 'turn:turn.example.com?transport=udp');
    expect(turnServer.username).toMatch(/^\d+$/);
    expect(typeof turnServer.credential).toBe('string');
    expect(turnServer.credential.length).toBeGreaterThan(0);
  });

  it('produces different credentials for different secrets', async () => {
    process.env.TURN_SERVER_URL = 'turn.example.com';
    process.env.TURN_SECRET = 'secret-a';
    const resA = makeRes();
    await getIce({}, resA);
    const credentialA = resA.json.mock.calls[0][0][1].credential;

    process.env.TURN_SECRET = 'secret-b';
    const resB = makeRes();
    await getIce({}, resB);
    const credentialB = resB.json.mock.calls[0][0][1].credential;

    expect(credentialA).not.toBe(credentialB);
  });

  it('errors when neither self-hosted TURN nor Twilio is configured', async () => {
    const res = makeRes();
    await getIce({}, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'No TURN provider configured' });
  });
});
