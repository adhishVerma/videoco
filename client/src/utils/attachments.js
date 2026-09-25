import axios from 'axios';
import * as api from './api';

export const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024; // keep in sync with server/controllers/attachments.js

// Uploads a file straight to R2 via a server-issued pre-signed URL - the
// file bytes never pass through our own server. Returns metadata to attach
// to a chat message, or throws if attachments aren't configured / upload
// fails.
export const uploadAttachment = async (file) => {
    if (file.size > MAX_FILE_SIZE_BYTES) {
        throw new Error(`File too large - max ${MAX_FILE_SIZE_BYTES / (1024 * 1024)}MB`);
    }

    const contentType = file.type || 'application/octet-stream';
    const { uploadUrl, fileUrl } = await api.getUploadUrl(file.name, contentType, file.size);

    await axios.put(uploadUrl, file, {
        headers: { 'Content-Type': contentType },
    });

    return {
        url: fileUrl,
        name: file.name,
        size: file.size,
        type: contentType,
    };
};
