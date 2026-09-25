const crypto = require('crypto');
const twilio = require('twilio')
require('dotenv').config();

const TURN_CREDENTIAL_TTL_SECONDS = 60 * 60;

// coturn's REST API credential scheme: username is a unix timestamp (the
// credential's expiry), password is HMAC-SHA1(secret, username) - the same
// shared secret is set in turnserver.conf. No long-lived secret ever
// reaches the browser.
const getSelfHostedTurnServers = () => {
    const turnServerUrl = process.env.TURN_SERVER_URL;
    const turnSecret = process.env.TURN_SECRET;

    if (!turnServerUrl || !turnSecret) {
        return null;
    }

    const username = `${Math.floor(Date.now() / 1000) + TURN_CREDENTIAL_TTL_SECONDS}`;
    const credential = crypto.createHmac('sha1', turnSecret).update(username).digest('base64');

    return [
        { urls: `stun:${turnServerUrl}` },
        { urls: `turn:${turnServerUrl}?transport=udp`, username, credential },
        { urls: `turn:${turnServerUrl}?transport=tcp`, username, credential },
        { urls: `turns:${turnServerUrl}`, username, credential },
    ];
};

const getTwilioIceServers = async () => {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;

    if (!accountSid || !authToken) {
        return null;
    }

    const client = twilio(accountSid, authToken);
    const token = await client.tokens.create();
    return token.iceServers;
};

const getIce = async (req, res) => {
    const selfHostedServers = getSelfHostedTurnServers();
    if (selfHostedServers) {
        return res.status(200).json(selfHostedServers);
    }

    try {
        const twilioServers = await getTwilioIceServers();
        if (!twilioServers) {
            return res.status(500).json({ error: 'No TURN provider configured' });
        }
        return res.status(200).json(twilioServers);
    } catch (err) {
        console.error('failed to fetch TURN credentials', err);
        return res.status(502).json({ error: 'Failed to fetch TURN credentials' });
    }
};

module.exports = { getIce }
