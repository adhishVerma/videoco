// Explicit mock factories, rather than bare jest.mock('axios')/jest.mock('./api')
// automocking - axios ships as an ESM-only package.json ("type": "module")
// that Jest's CJS-based automock can't parse without a factory to fall back to.
jest.mock('axios', () => ({
    __esModule: true,
    default: { put: jest.fn() },
}));
jest.mock('./api', () => ({
    getUploadUrl: jest.fn(),
}));

import axios from 'axios';
import { uploadAttachment, MAX_FILE_SIZE_BYTES } from './attachments';
import * as api from './api';

const makeFile = (size, type = 'image/png', name = 'photo.png') => ({
    name,
    size,
    type,
});

describe('uploadAttachment', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('rejects a file over the size limit without calling the server', async () => {
        const file = makeFile(MAX_FILE_SIZE_BYTES + 1);

        await expect(uploadAttachment(file)).rejects.toThrow(/too large/i);
        expect(api.getUploadUrl).not.toHaveBeenCalled();
    });

    it('requests a presigned URL, PUTs the file to it, and returns attachment metadata', async () => {
        const file = makeFile(1024, 'video/mp4', 'clip.mp4');
        api.getUploadUrl.mockResolvedValue({
            uploadUrl: 'https://r2.example.com/signed',
            fileUrl: 'https://cdn.example.com/clip.mp4',
        });
        axios.put.mockResolvedValue({});

        const result = await uploadAttachment(file);

        expect(api.getUploadUrl).toHaveBeenCalledWith('clip.mp4', 'video/mp4', 1024);
        expect(axios.put).toHaveBeenCalledWith(
            'https://r2.example.com/signed',
            file,
            { headers: { 'Content-Type': 'video/mp4' } },
        );
        expect(result).toEqual({
            url: 'https://cdn.example.com/clip.mp4',
            name: 'clip.mp4',
            size: 1024,
            type: 'video/mp4',
        });
    });

    it('defaults to application/octet-stream when the file has no type', async () => {
        const file = makeFile(1024, '', 'mystery.bin');
        api.getUploadUrl.mockResolvedValue({ uploadUrl: 'https://r2.example.com/signed', fileUrl: null });
        axios.put.mockResolvedValue({});

        await uploadAttachment(file);

        expect(api.getUploadUrl).toHaveBeenCalledWith('mystery.bin', 'application/octet-stream', 1024);
    });

    it('turns a response-less network error into the CORS hint', async () => {
        const file = makeFile(1024);
        api.getUploadUrl.mockResolvedValue({ uploadUrl: 'https://r2.example.com/signed', fileUrl: 'https://cdn.example.com/photo.png' });
        axios.put.mockRejectedValue({ request: {}, response: undefined });

        await expect(uploadAttachment(file)).rejects.toThrow(/CORS policy/i);
    });

    it('rethrows an error that has a real server response as-is', async () => {
        const file = makeFile(1024);
        const serverError = { response: { status: 500 }, message: 'boom' };
        api.getUploadUrl.mockResolvedValue({ uploadUrl: 'https://r2.example.com/signed', fileUrl: 'https://cdn.example.com/photo.png' });
        axios.put.mockRejectedValue(serverError);

        await expect(uploadAttachment(file)).rejects.toBe(serverError);
    });
});
