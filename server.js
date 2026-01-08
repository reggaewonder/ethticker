// server.js – FIXED VERSION
const express = require('express');
const path = require('path');
const http = require('http');
const WebSocket = require('ws');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));
app.get('/health', (req, res) => res.json({ status: 'ok' }));

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

let latestTicker = null;

// CORRECT Binance spot ETH/USDT ticker stream[web:28]
const BINANCE_WS_URL = 'wss://stream.binance.com:9443/ws/ethusdt@ticker';

let binanceWs = null;

function connectToBinance() {
  console.log(`Connecting to ${BINANCE_WS_URL}`);
  binanceWs = new WebSocket(BINANCE_WS_URL);

  binanceWs.on('open', () => {
    console.log('✅ Binance ETHUSDT ticker CONNECTED');
  });

  binanceWs.on('message', (data) => {
    try {
      const parsed = JSON.parse(data.toString());
      latestTicker = parsed;
      console.log(`📊 Ticker update: ${parsed.c} (24h ${parsed.P}%)`); // DEBUG log

      const msg = JSON.stringify({ type: 'ticker', data: parsed });
      wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(msg);
        }
      });
    } catch (err) {
      console.error('❌ Ticker parse error:', err.message, 'raw:', data.toString().slice(0,100));
    }
  });

  binanceWs.on('close', (code, reason) => {
    console.log(`🔌 Binance closed (code ${code}): ${reason || 'unknown'}. Reconnecting in 5s...`);
    setTimeout(connectToBinance, 5000);
  });

  binanceWs.on('error', (err) => {
    console.error('❌ Binance WebSocket error:', err.message);
  });
}

wss.on('connection', (ws) => {
  console.log('👤 Browser client connected');
  if (latestTicker) {
    ws.send(JSON.stringify({ type: 'ticker', data: latestTicker }));
  }
  ws.on('close', () => console.log('👤 Browser client disconnected'));
});

server.listen(PORT, () => {
  console.log(`🚀 Server on port ${PORT}`);
});

connectToBinance();

