require('dotenv').config();
const { createApp } = require('./app');

const { server, config } = createApp();

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log('listening on :', PORT);
  console.log(
    config.aloneTimeoutMs > 0
      ? `rooms with a single participant end after ${Math.round(config.aloneTimeoutMs / 1000)}s`
      : 'idle room timeout disabled'
  );
});
