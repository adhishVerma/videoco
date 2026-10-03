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

// Tokens are minted over the authenticated socket connection (see app.js's
// 'livekit-token' handler), NOT an open HTTP endpoint. That matters: the
// identity baked into the token must be the caller's real socket id. When
// the client could claim any socketId over HTTP, a participant could request
// a token as someone else's identity - and LiveKit kicks the existing holder
// of a duplicate identity, so that was a way to eject anyone from a call.
const createAccessToken = async ({ roomId, identity, name }) => {
    const at = new AccessToken(process.env.LIVEKIT_API_KEY, process.env.LIVEKIT_API_SECRET, {
        identity,
        name,
        ttl: TOKEN_TTL,
    });
    at.addGrant({
        room: roomId,
        roomJoin: true,
        canPublish: true,
        canSubscribe: true,
        canPublishData: true,
    });
    return at.toJwt();
};

const getRoomService = () => {
    return new RoomServiceClient(process.env.LIVEKIT_URL, process.env.LIVEKIT_API_KEY, process.env.LIVEKIT_API_SECRET);
};

const isNotFound = (err) => {
    return err && (err.status === 404 || err.code === 'not_found' || /not.?found|does not exist/i.test(err.message || ''));
};

// Socket-level disconnect already drops the target from the UI, but LiveKit
// keeps publishing their media through the SFU independently of that socket -
// this is what actually stops their stream (and their billing) when a host
// removes someone, or their socket dies. identity is the socket id.
const removeLiveKitParticipant = async (roomId, identity) => {
    if (!isLiveKitConfigured()) return;
    try {
        await getRoomService().removeParticipant(roomId, identity);
    } catch (err) {
        // "participant not found" is the normal case (they already left);
        // anything else is worth a log but never fatal to the caller.
        if (!isNotFound(err)) console.error('failed to remove LiveKit participant', err);
    }
};

// Tears down the SFU room outright once our room closes, instead of waiting
// out LiveKit's own empty-room timeout, so no lingering session keeps accruing.
const deleteLiveKitRoom = async (roomId) => {
    if (!isLiveKitConfigured()) return;
    try {
        await getRoomService().deleteRoom(roomId);
    } catch (err) {
        if (!isNotFound(err)) console.error('failed to delete LiveKit room', err);
    }
};

module.exports = {
    isLiveKitConfigured,
    getLiveKitStatus,
    createAccessToken,
    removeLiveKitParticipant,
    deleteLiveKitRoom,
};
