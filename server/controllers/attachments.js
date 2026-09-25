const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024; // 25MB
const UPLOAD_URL_TTL_SECONDS = 5 * 60;
const ALLOWED_CONTENT_TYPE_PREFIXES = ['image/', 'video/', 'audio/', 'application/pdf', 'text/plain'];

// R2 is S3-API-compatible - same SDK, just a different endpoint. Fill these
// in once you have a bucket: R2 dashboard -> Manage API tokens -> create an
// S3 API token, and R2_PUBLIC_URL is either the bucket's r2.dev URL or a
// custom domain you've attached to it (Settings -> Public access).
const isR2Configured = () => {
    return !!(
        process.env.R2_ACCOUNT_ID &&
        process.env.R2_ACCESS_KEY_ID &&
        process.env.R2_SECRET_ACCESS_KEY &&
        process.env.R2_BUCKET_NAME
    );
};

const getR2Client = () => {
    return new S3Client({
        region: 'auto',
        endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
        credentials: {
            accessKeyId: process.env.R2_ACCESS_KEY_ID,
            secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
        },
    });
};

const sanitizeFileName = (fileName) => {
    return (fileName || 'file').replace(/[^a-zA-Z0-9.\-_]/g, '_').slice(-100);
};

// lets the client check once (e.g. on mount) whether to show the
// attachment button at all, instead of showing it and failing on click.
const getAttachmentsStatus = (req, res) => {
    res.status(200).json({ enabled: isR2Configured() });
};

const getUploadUrl = async (req, res) => {
    if (!isR2Configured()) {
        return res.status(501).json({ error: 'Attachments are not configured on this server' });
    }

    const { fileName, contentType, fileSize } = req.body || {};

    if (!fileName || !contentType) {
        return res.status(400).json({ error: 'fileName and contentType are required' });
    }

    if (typeof fileSize === 'number' && fileSize > MAX_FILE_SIZE_BYTES) {
        return res.status(413).json({ error: `File too large - max ${MAX_FILE_SIZE_BYTES / (1024 * 1024)}MB` });
    }

    const isAllowedType = ALLOWED_CONTENT_TYPE_PREFIXES.some((prefix) => contentType.startsWith(prefix));
    if (!isAllowedType) {
        return res.status(415).json({ error: 'File type not allowed' });
    }

    const key = `${uuidv4()}-${sanitizeFileName(fileName)}`;

    try {
        const client = getR2Client();
        const command = new PutObjectCommand({
            Bucket: process.env.R2_BUCKET_NAME,
            Key: key,
            ContentType: contentType,
        });

        const uploadUrl = await getSignedUrl(client, command, { expiresIn: UPLOAD_URL_TTL_SECONDS });
        const publicBaseUrl = (process.env.R2_PUBLIC_URL || '').replace(/\/$/, '');
        const fileUrl = publicBaseUrl ? `${publicBaseUrl}/${key}` : null;

        return res.status(200).json({ uploadUrl, fileUrl, key, expiresIn: UPLOAD_URL_TTL_SECONDS });
    } catch (err) {
        console.error('failed to create attachment upload URL', err);
        return res.status(502).json({ error: 'Failed to create upload URL' });
    }
};

module.exports = {
    isR2Configured,
    getAttachmentsStatus,
    getUploadUrl,
    MAX_FILE_SIZE_BYTES,
    ALLOWED_CONTENT_TYPE_PREFIXES,
};
