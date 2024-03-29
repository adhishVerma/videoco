const twilio = require('twilio')
require('dotenv').config();

const getIce = (req,res) => {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const client = twilio(accountSid, authToken);

    client.tokens.create().then(token => res.status(200).json(token.iceServers)).catch(err => console.log(err));
};

module.exports = {getIce}