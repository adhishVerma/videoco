const { AccessToken, RoomServiceClient } = require('livekit-server-sdk');

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
    const access = await roomsStore.checkRoomAccess(store, roomId, password);
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

// Socket-level disconnect (see index.js's remove-participant handler)
// already drops the target from the mesh/UI, but LiveKit keeps publishing
// their media through the SFU independently of that socket - this is what
// actually stops their stream when a host removes someone mid-call.
// identity is the LiveKit participant identity, which the token handler
// above sets to the socket id, so callers pass the same socketId here.
const removeLiveKitParticipant = async (roomId, identity) => {
    if (!isLiveKitConfigured()) return;
    try {
        const client = new RoomServiceClient(process.env.LIVEKIT_URL, process.env.LIVEKIT_API_KEY, process.env.LIVEKIT_API_SECRET);
        await client.removeParticipant(roomId, identity);
    } catch (err) {
        // participant may have already left, or never actually published to
        // LiveKit (e.g. still on the mesh fallback) - not fatal either way.
        console.error('failed to remove LiveKit participant', err);
    }
};

module.exports = {
    isLiveKitConfigured,
    getLiveKitStatus,
    createGetTokenHandler,
    removeLiveKitParticipant,
};
