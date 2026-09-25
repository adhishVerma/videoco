const { AccessToken } = require('livekit-server-sdk');
require('dotenv').config();

const TOKEN_TTL = '10m';

const isLiveKitConfigured = () => {
    return !!(process.env.LIVEKIT_API_KEY && process.env.LIVEKIT_API_SECRET && process.env.LIVEKIT_URL);
};

// lets the client decide, once, whether to use the LiveKit SFU path or fall
// back to the peer-to-peer mesh - same pattern as attachments-status.
const getLiveKitStatus = (req, res) => {
    res.status(200).json({
        enabled: isLiveKitConfigured(),
        url: isLiveKitConfigured() ? process.env.LIVEKIT_URL : null,
    });
};

// roomsStore/store are injected so this stays testable without a running
// socket server - see server/index.js for the wiring.
const createGetTokenHandler = (roomsStore, store) => async (req, res) => {
    if (!isLiveKitConfigured()) {
        return res.status(501).json({ error: 'LiveKit is not configured on this server' });
    }

    const { roomId, identity, socketId, password } = req.body || {};

    if (!roomId || !identity || !socketId) {
        return res.status(400).json({ error: 'roomId, identity and socketId are required' });
    }

    // re-checks the room's password even though the caller already joined
    // over the socket - the LiveKit token is a second, independent grant and
    // shouldn't be handed out to someone who never proved they knew the
    // password, if the socket layer is ever bypassed.
    const access = roomsStore.checkRoomAccess(store, roomId, password);
    if (access.error) {
        const status = access.error === 'invalid-password' ? 403 : 404;
        return res.status(status).json({ error: access.error });
    }

    try {
        const at = new AccessToken(process.env.LIVEKIT_API_KEY, process.env.LIVEKIT_API_SECRET, {
            // identity is the socket id, matching the identity our own
            // socket.io "participants" list already keys by, so chat/
            // caption/UI code that looks participants up by socketId keeps
            // working unchanged against LiveKit's remote participants too.
            identity: socketId,
            name: identity,
            ttl: TOKEN_TTL,
        });
        at.addGrant({
            room: roomId,
            roomJoin: true,
            canPublish: true,
            canSubscribe: true,
            canPublishData: true,
        });

        const token = await at.toJwt();
        return res.status(200).json({ token, url: process.env.LIVEKIT_URL });
    } catch (err) {
        console.error('failed to create LiveKit token', err);
        return res.status(502).json({ error: 'Failed to create LiveKit token' });
    }
};

module.exports = {
    isLiveKitConfigured,
    getLiveKitStatus,
    createGetTokenHandler,
};
