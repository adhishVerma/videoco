// cronjob to keep the server alive
var https = require('https');
var cron = require('cron');

var url = `https://videoco-backend.onrender.com`
var job = new cron.CronJob('*/14 * * * *', function () {
    console.log('keeping server alive');

    https.get(url, (res) => {
        if (res.statusCode === 200) {
            console.log('server-live')
        } else {
            console.error('server-shut')
        }
    }).on('error', (err) => {
            console.error(err.message);
        });
});

module.exports = job