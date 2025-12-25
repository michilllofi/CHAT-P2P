const express = require('express');
const { ExpressPeerServer } = require('peer');

const app = express();
const PORT = 9000;

// Start HTTP server
const server = app.listen(PORT, () => {
  console.log(`PeerJS server running on http://localhost:${PORT}`);
});

// Create PeerJS server
const peerServer = ExpressPeerServer(server, {
  path: '/',
  debug: true
});

app.use('/peerjs', peerServer);

// Optional root route
app.get('/', (req, res) => {
  res.send('PeerJS Server is running');
});
