const path = require('path');
const fs = require('fs');
const http = require('http');
const express = require('express');
const { WebSocketServer } = require('ws');

const app = express();
const PORT = process.env.PORT || 3000;

// Serve static game assets with caching disabled for instant live edits
app.use(express.static(path.join(__dirname), { etag: false, maxAge: 0 }));

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

let quotes = [];
try {
  quotes = JSON.parse(fs.readFileSync(path.join(__dirname, 'quotes.json'), 'utf8'));
} catch (e) {
  quotes = [{ text: "Any fool can write code that a computer can understand Good programmers write code that humans can understand" }];
}

function getRandomQuote() {
  return quotes[Math.floor(Math.random() * quotes.length)].text;
}

let waitingPlayer = null;

wss.on('connection', (ws) => {
  ws.opponent = null;

  ws.on('message', (msgStr) => {
    try {
      const msg = JSON.parse(msgStr);

      // ─── 1. Matchmaking ───
      if (msg.type === 'FIND_MATCH') {
        if (waitingPlayer && waitingPlayer !== ws && waitingPlayer.readyState === 1) {
          const p1 = waitingPlayer;
          const p2 = ws;
          waitingPlayer = null;

          p1.opponent = p2;
          p2.opponent = p1;

          const paragraph = getRandomQuote();
          p1.send(JSON.stringify({ type: 'MATCH_START', paragraph, role: 'p1' }));
          p2.send(JSON.stringify({ type: 'MATCH_START', paragraph, role: 'p2' }));
        } else {
          waitingPlayer = ws;
          ws.send(JSON.stringify({ type: 'WAITING' }));
        }
      }

      // ─── 2. Cancel Queue ───
      if (msg.type === 'CANCEL_QUEUE') {
        if (waitingPlayer === ws) waitingPlayer = null;
      }

      // ─── 3. Keystroke Progress Relay (<30ms) ───
      if (msg.type === 'PROGRESS') {
        if (ws.opponent && ws.opponent.readyState === 1) {
          ws.opponent.send(JSON.stringify({
            type: 'OPPONENT_PROGRESS',
            charIndex: msg.charIndex,
            wpm: msg.wpm
          }));
        }
      }

      // ─── 4. Race Finish ───
      if (msg.type === 'FINISH') {
        if (ws.opponent && ws.opponent.readyState === 1) {
          ws.opponent.send(JSON.stringify({
            type: 'OPPONENT_FINISHED',
            stats: msg.stats
          }));
        }
      }
    } catch (err) {
      console.error('WS Error:', err);
    }
  });

  // ─── 5. Cleanup on Disconnect ───
  ws.on('close', () => {
    if (waitingPlayer === ws) waitingPlayer = null;
    if (ws.opponent && ws.opponent.readyState === 1) {
      ws.opponent.send(JSON.stringify({ type: 'OPPONENT_DISCONNECTED' }));
      ws.opponent.opponent = null;
    }
  });
});

server.listen(PORT, () => {
  console.log(`⚡ SYNTAX//RUSH Relay Server running on http://localhost:${PORT}`);
});
