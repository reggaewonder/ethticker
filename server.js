// server.js
const express = require('express');
const path = require('path');
const http = require('http');
const WebSocket = require('ws');

const app = express();

// Railway sets PORT in the environment
const PORT = process.env.PORT || 3000;

// Serve static files from /public
app.use(express.static(path.join(__dirname, 'public')));

// Basic health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Create HTTP server explicitly so WS can share the same port
const server = http.createServer(app);

// WebSocket server for browser clients
const wss = new WebSocket.Server({ server });

// --- Binance streaming setup ---

// Latest ticker snapshot
let latestTicker = null;

// Binance spot WebSocket endpoint for ETH/USDT ticker
// Docs: ethusdt@ticker returns fields like c (last price), P (% change), p (change), h, l, v.[web:28]
const BINANCE_WS_URL = 'wss://stream.binance.com:9443/ws/ethusdt@ticker';

let binanceWs = null;

function connectToBinance() {
  console.log('Connecting to Binance ETHUSDT ticker...');
  binanceWs = new WebSocket(BINANCE_WS_URL);

  binanceWs.on('open', () => {
    console.log('Connected to Binance ETHUSDT ticker');
  });

  binanceWs.on('message', (data) => {
    try {
      const parsed = JSON.parse(data);
      latestTicker = parsed;

      // Broadcast to all connected browser clients
      const msg = JSON.stringify({ type: 'ticker', data: parsed });
      wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(msg);
        }
      });
    } catch (err) {
      console.error('Error parsing Binance ticker message:', err.message);
    }
  });

  binanceWs.on('close', () => {
    console.warn('Binance ticker connection closed. Reconnecting in 5s...');
    setTimeout(connectToBinance, 5000);
  });

  binanceWs.on('error', (err) => {
    console.error('Binance ticker WebSocket error:', err.message);
    // Let 'close' handler do the reconnect
  });
}

// Handle browser client WebSocket connections
wss.on('connection', (ws) => {
  console.log('Browser client connected');

  // On connect, send the latest ticker snapshot if we have one
  if (latestTicker) {
    ws.send(JSON.stringify({ type: 'ticker', data: latestTicker }));
  }

  ws.on('close', () => {
    console.log('Browser client disconnected');
  });
});

// Start HTTP + WS server
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});

// Start Binance stream connection
connectToBinance();
