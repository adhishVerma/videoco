jest.mock('axios', () => ({
    __esModule: true,
    default: { get: jest.fn(), post: jest.fn() },
}));

import axios from 'axios';
import * as api from './api';

describe('api', () => {
    beforeEach(() => {
        axios.get.mockResolvedValue({ data: { ok: true } });
        axios.post.mockResolvedValue({ data: { ok: true } });
    });

    // every request needs a timeout - axios has none by default, so an
    // unresponsive server would hang whatever is awaiting the call
    const lastOptions = (method) => axios[method].mock.calls.at(-1).at(-1);

    it.each([
        ['getRoomExists', () => api.getRoomExists('room-1'), 'get'],
        ['getTURNCredentials', () => api.getTURNCredentials(), 'get'],
        ['getAttachmentsStatus', () => api.getAttachmentsStatus(), 'get'],
        ['getLiveKitStatus', () => api.getLiveKitStatus(), 'get'],
        ['getUploadUrl', () => api.getUploadUrl('a.png', 'image/png', 10), 'post'],
    ])('%s has a timeout and returns the response body', async (name, call, method) => {
        const data = await call();

        expect(data).toEqual({ ok: true });
        expect(lastOptions(method)).toEqual({ timeout: expect.any(Number) });
        expect(lastOptions(method).timeout).toBeGreaterThan(0);
    });

    it('escapes the room id in the URL', async () => {
        await api.getRoomExists('a/b?c');

        expect(axios.get.mock.calls[0][0]).toContain('/api/room-exists/a%2Fb%3Fc');
    });

    it('posts the upload details', async () => {
        await api.getUploadUrl('a.png', 'image/png', 10);

        expect(axios.post.mock.calls[0][1]).toEqual({ fileName: 'a.png', contentType: 'image/png', fileSize: 10 });
    });

    it('lets failures through to the caller', async () => {
        axios.get.mockRejectedValue(new Error('boom'));

        await expect(api.getLiveKitStatus()).rejects.toThrow('boom');
    });
});
