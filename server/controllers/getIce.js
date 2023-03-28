require("dotenv").config()

const getIce = (req,res) => {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const client = require('twilio')(accountSid, authToken);

    client.tokens.create().then(token => res.json(token.iceServers));
};

module.exports = {getIce}