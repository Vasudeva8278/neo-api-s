const http = require('http');
const dotenv = require('dotenv');

process.on("uncaughtException", err => {
  console.log('[uncaughtException] Shutting down server ...');
  console.log(err.name, err.message);
  process.exit(1);
})

dotenv.config({ path: './.env' });
const app = require('./app');



var httpServer = http.createServer(app);

const server = httpServer.listen(process.env.PORT, () => {
  console.log("server up and running : ", process.env.PORT);
});
