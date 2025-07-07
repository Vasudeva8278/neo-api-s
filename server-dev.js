const http = require('http');
const dotenv = require('dotenv');

process.on("uncaughtException", err => {
  console.log('[uncaughtException] Shutting down server ...');
  console.log(err.name, err.message);
  process.exit(1);
})

dotenv.config({ path: './.env' });
const app = require('./appdev');



var httpServer = http.createServer(app);

const server = httpServer.listen(7002, () => {
  console.log("server up and running : ", 7002);
});
