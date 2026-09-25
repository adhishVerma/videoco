const makeRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe('attachments', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    delete process.env.R2_ACCOUNT_ID;
    delete process.env.R2_ACCESS_KEY_ID;
    delete process.env.R2_SECRET_ACCESS_KEY;
    delete process.env.R2_BUCKET_NAME;
    delete process.env.R2_PUBLIC_URL;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('getAttachmentsStatus', () => {
    it('reports disabled when R2 env vars are not set', () => {
      const { getAttachmentsStatus } = require('./attachments');
      const res = makeRes();

      getAttachmentsStatus({}, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ enabled: false });
    });

    it('reports enabled once all required R2 env vars are set', () => {
      process.env.R2_ACCOUNT_ID = 'acct';
      process.env.R2_ACCESS_KEY_ID = 'key';
      process.env.R2_SECRET_ACCESS_KEY = 'secret';
      process.env.R2_BUCKET_NAME = 'bucket';

      const { getAttachmentsStatus } = require('./attachments');
      const res = makeRes();

      getAttachmentsStatus({}, res);

      expect(res.json).toHaveBeenCalledWith({ enabled: true });
    });
  });

  describe('getUploadUrl', () => {
    it('returns 501 when R2 is not configured', async () => {
      const { getUploadUrl } = require('./attachments');
      const res = makeRes();

      await getUploadUrl({ body: { fileName: 'a.png', contentType: 'image/png' } }, res);

      expect(res.status).toHaveBeenCalledWith(501);
    });

    it('validates required fields once configured', async () => {
      process.env.R2_ACCOUNT_ID = 'acct';
      process.env.R2_ACCESS_KEY_ID = 'key';
      process.env.R2_SECRET_ACCESS_KEY = 'secret';
      process.env.R2_BUCKET_NAME = 'bucket';

      const { getUploadUrl } = require('./attachments');
      const res = makeRes();

      await getUploadUrl({ body: {} }, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('rejects files over the size limit', async () => {
      process.env.R2_ACCOUNT_ID = 'acct';
      process.env.R2_ACCESS_KEY_ID = 'key';
      process.env.R2_SECRET_ACCESS_KEY = 'secret';
      process.env.R2_BUCKET_NAME = 'bucket';

      const { getUploadUrl, MAX_FILE_SIZE_BYTES } = require('./attachments');
      const res = makeRes();

      await getUploadUrl(
        { body: { fileName: 'big.png', contentType: 'image/png', fileSize: MAX_FILE_SIZE_BYTES + 1 } },
        res
      );

      expect(res.status).toHaveBeenCalledWith(413);
    });

    it('rejects disallowed content types', async () => {
      process.env.R2_ACCOUNT_ID = 'acct';
      process.env.R2_ACCESS_KEY_ID = 'key';
      process.env.R2_SECRET_ACCESS_KEY = 'secret';
      process.env.R2_BUCKET_NAME = 'bucket';

      const { getUploadUrl } = require('./attachments');
      const res = makeRes();

      await getUploadUrl(
        { body: { fileName: 'script.exe', contentType: 'application/x-msdownload' } },
        res
      );

      expect(res.status).toHaveBeenCalledWith(415);
    });

    it('generates a presigned URL and a sanitized key for an allowed type', async () => {
      process.env.R2_ACCOUNT_ID = 'acct';
      process.env.R2_ACCESS_KEY_ID = 'key';
      process.env.R2_SECRET_ACCESS_KEY = 'secret';
      process.env.R2_BUCKET_NAME = 'bucket';
      process.env.R2_PUBLIC_URL = 'https://files.example.com/';

      const { getUploadUrl } = require('./attachments');
      const res = makeRes();

      await getUploadUrl(
        { body: { fileName: 'my photo (1).png', contentType: 'image/png', fileSize: 1024 } },
        res
      );

      expect(res.status).toHaveBeenCalledWith(200);
      const payload = res.json.mock.calls[0][0];
      expect(typeof payload.uploadUrl).toBe('string');
      expect(payload.uploadUrl.length).toBeGreaterThan(0);
      expect(payload.key).toMatch(/^[a-f0-9-]{36}-my_photo__1_\.png$/);
      expect(payload.fileUrl).toBe(`https://files.example.com/${payload.key}`);
    });
  });
});
