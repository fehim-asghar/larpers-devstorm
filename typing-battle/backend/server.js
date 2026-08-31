const path = require('path');
const fs = require('fs');
const http = require('http');
const crypto = require('crypto');
const express = require('express');
const { WebSocketServer } = require('ws');

// Load .env if present
try {
  const envContent = fs.readFileSync(path.join(__dirname, '../.env'), 'utf8');
  envContent.split('\n').forEach(line => {
    const parts = line.trim().split('=');
    if (parts.length >= 2 && parts[0] && !process.env[parts[0]]) {
      process.env[parts[0]] = parts.slice(1).join('=');
    }
  });
} catch (e) {}

const app = express();
const PORT = process.env.PORT || 3000;

const { OAuth2Client } = require('google-auth-library');
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '996351835462-2pmv3rsnkdjc8d13gv3ajda7jn45mac4.apps.googleusercontent.com';
const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);

const db = require('./db');

// In-Memory Session Token Store (token -> { userId, expiresAt })
const sessionTokens = new Map();

function createSessionToken(userId) {
  const token = 'tok_' + crypto.randomBytes(24).toString('hex');
  const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000; // 7 days
  sessionTokens.set(token, { userId, expiresAt });
  return token;
}

function getUserFromSessionToken(token) {
  if (!token || typeof token !== 'string') return null;
  const session = sessionTokens.get(token);
  if (!session) return null;
  if (Date.now() > session.expiresAt) {
    sessionTokens.delete(token);
    return null;
  }
  return db.getUserById(session.userId);
}

let quotes = [];
try {
  quotes = JSON.parse(fs.readFileSync(path.join(__dirname, '../frontend/quotes.json'), 'utf8'));
} catch (e) {
  quotes = [{ text: 'Any fool can write code that a computer can understand Good programmers write code that humans can understand' }];
}

function getRandomQuote() {
  try {
    quotes = JSON.parse(fs.readFileSync(path.join(__dirname, '../frontend/quotes.json'), 'utf8'));
  } catch (e) {}
  return quotes[Math.floor(Math.random() * quotes.length)].text;
}

app.use(express.json());

// ─── Auth API ───
app.get('/api/auth/config', (req, res) => {
  res.json({ googleClientId: GOOGLE_CLIENT_ID });
});

app.post('/api/auth/google', async (req, res) => {
  try {
    const { credential, mockUser } = req.body;
    let googleId, username, avatarUrl;

    if (credential) {
      if (GOOGLE_CLIENT_ID) {
        const ticket = await googleClient.verifyIdToken({
          idToken: credential,
          audience: GOOGLE_CLIENT_ID,
        });
        const payload = ticket.getPayload();
        googleId = payload.sub;
        username = payload.name;
        avatarUrl = payload.picture;
      } else {
        // Fallback base64 decoder if testing with raw Google credential
        const base64Url = credential.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const payload = JSON.parse(Buffer.from(base64, 'base64').toString('utf8'));
        googleId = payload.sub || 'g_' + Math.random().toString(36).slice(2);
        username = payload.name || 'Google User';
        avatarUrl = payload.picture || null;
      }
    } else if (mockUser) {
      // Gate mock auth behind environment flag for production safety
      if (process.env.ALLOW_MOCK_AUTH !== 'true') {
        return res.status(403).json({ error: 'Mock authentication is disabled in production.' });
      }
      googleId = 'mock_g_' + (mockUser.id || 'dev_user');
      username = mockUser.username || 'Faheem (Ranked)';
      avatarUrl = mockUser.avatar_url || 'https://api.dicebear.com/7.x/bottts/svg?seed=Faheem';
    } else {
      return res.status(400).json({ error: 'Missing credential or mockUser' });
    }

    const user = db.upsertGoogleUser({ googleId, username, avatarUrl });
    const token = createSessionToken(user.id);
    return res.json({ success: true, user, token });
  } catch (err) {
    console.error('Google Auth Error:', err);
    return res.status(401).json({ error: 'Invalid Google credential' });
  }
});

app.get('/api/profile/me', (req, res) => {
  const userId = req.query.userId;
  if (!userId) return res.status(400).json({ error: 'Missing userId' });
  const user = db.getUserById(userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  return res.json({ user });
});

app.get('/api/leaderboard', (req, res) => {
  try {
    const limit = Math.min(100, parseInt(req.query.limit) || 50);
    const leaderboard = db.getLeaderboard(limit);
    return res.json(leaderboard);
  } catch (err) {
    console.error('Leaderboard error:', err);
    return res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
});

app.get('/api/matches/recent', (req, res) => {
  try {
    const userId = req.query.userId || null;
    const limit = Math.min(50, parseInt(req.query.limit) || 20);
    const matches = db.getRecentMatches(userId, limit);
    return res.json(matches);
  } catch (err) {
    console.error('Recent matches error:', err);
    return res.status(500).json({ error: 'Failed to fetch recent matches' });
  }
});

// Serve static game assets from frontend folder
app.use(express.static(path.join(__dirname, '../frontend'), { etag: false, maxAge: 0 }));

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

let rankedQueue = []; // [{ ws, user, joinedAt }]
let customRooms = new Map(); // roomCode -> { hostWs, guestWs, roomCode, hostUser, guestUser, paragraph }
let activeMatches = new Map(); // matchId -> session

function computeMmrDeltas(winnerUser, loserUser, winnerStats, loserStats) {
  let winnerDelta = 25; // Base win
  const loserDelta = -15; // Base loss

  const bonuses = [];
  // +10 Flawless run (100% accuracy)
  if (winnerStats && winnerStats.accuracy === 100) {
    winnerDelta += 10;
    bonuses.push('🎯 Flawless (+10)');
  }
  // +8 Personal best speed
  if (winnerStats && winnerUser && winnerStats.wpm > (winnerUser.best_wpm || 0)) {
    winnerDelta += 8;
    bonuses.push('🔥 Speed Record (+8)');
  }
  // +7 Win streak (3+ consecutive wins: winner currently has a win_streak of 2+ before this win)
  if (winnerUser && (winnerUser.win_streak || 0) >= 2) {
    winnerDelta += 7;
    bonuses.push('⚡ 3+ Streak (+7)');
  }
  // +5 Blowout victory (5+ seconds lead)
  if (winnerStats && loserStats && (loserStats.timeMs - winnerStats.timeMs) >= 5000) {
    winnerDelta += 5;
    bonuses.push('🏎️ Blowout (+5)');
  }

  return { winnerDelta, loserDelta, bonuses };
}

wss.on('connection', (ws) => {
  ws.opponent = null;
  ws.matchSession = null;
  ws.user = {
    id: 'guest_' + crypto.randomBytes(3).toString('hex'),
    username: 'Guest ' + Math.floor(100 + Math.random() * 900),
    avatar_url: 'miku.gif',
    isGuest: true,
    mmr: 500
  };
  ws.roomCode = null;

  ws.on('message', (msgStr) => {
    try {
      const msg = JSON.parse(msgStr);

      // ─── 0. Session Authentication ───
      if (msg.type === 'AUTH') {
        const authUser = getUserFromSessionToken(msg.token);
        if (authUser) {
          ws.user = authUser;
          ws.send(JSON.stringify({ type: 'AUTH_SUCCESS', user: authUser }));
        } else {
          ws.send(JSON.stringify({ type: 'AUTH_REQUIRED', message: 'Guest mode active.' }));
        }
        return;
      }

      // ─── 1. Custom Unranked Rooms (Phase 5) ───
      if (msg.type === 'CREATE_ROOM') {
        const code = (msg.roomCode || 'RUSH-' + Math.floor(10 + Math.random() * 90)).toUpperCase();
        const isGuest = !ws.user || ws.user.isGuest || (ws.user.id && ws.user.id.startsWith('guest_'));
        const hostUser = isGuest ? { ...ws.user, username: 'Host (Guest)', isGuest: true } : ws.user;
        ws.user = hostUser;
        ws.roomCode = code;

        customRooms.set(code, {
          hostWs: ws,
          guestWs: null,
          roomCode: code,
          hostUser,
          guestUser: null,
          paragraph: getRandomQuote()
        });

        ws.send(JSON.stringify({ type: 'ROOM_CREATED', roomCode: code }));
      }

      if (msg.type === 'JOIN_ROOM') {
        const code = (msg.roomCode || '').trim().toUpperCase();
        const room = customRooms.get(code);

        if (!room) {
          ws.send(JSON.stringify({ type: 'ROOM_ERROR', message: `Room "${code}" not found. Check code.` }));
          return;
        }
        if (room.guestWs && room.guestWs !== ws && room.guestWs.readyState === 1) {
          ws.send(JSON.stringify({ type: 'ROOM_ERROR', message: `Room "${code}" is already full!` }));
          return;
        }

        const isGuest = !ws.user || ws.user.isGuest || (ws.user.id && ws.user.id.startsWith('guest_'));
        const guestUser = isGuest ? { ...ws.user, username: 'Friend (Guest)', isGuest: true } : ws.user;
        ws.user = guestUser;
        ws.roomCode = code;
        room.guestWs = ws;
        room.guestUser = guestUser;

        const matchId = 'custom_' + Math.random().toString(36).substring(2, 10);
        const now = Date.now();
        const session = {
          id: matchId,
          p1: room.hostWs,
          p2: room.guestWs,
          paragraph: room.paragraph,
          matchStartSentAt: now,
          p1Stats: null,
          p2Stats: null,
          isResolved: false,
          isRanked: false
        };

        room.hostWs.firstKeyAt = null;
        room.hostWs.lastKeyAt = null;
        room.guestWs.firstKeyAt = null;
        room.guestWs.lastKeyAt = null;

        room.hostWs.matchSession = session;
        room.guestWs.matchSession = session;
        room.hostWs.opponent = room.guestWs;
        room.guestWs.opponent = room.hostWs;
        activeMatches.set(matchId, session);

        room.hostWs.send(JSON.stringify({
          type: 'MATCH_START',
          paragraph: session.paragraph,
          role: 'p1',
          matchId,
          isRanked: false,
          opponentUser: room.guestUser
        }));
        room.guestWs.send(JSON.stringify({
          type: 'MATCH_START',
          paragraph: session.paragraph,
          role: 'p2',
          matchId,
          isRanked: false,
          opponentUser: room.hostUser
        }));
      }

      if (msg.type === 'LEAVE_ROOM') {
        if (ws.roomCode && customRooms.has(ws.roomCode)) {
          const room = customRooms.get(ws.roomCode);
          if (room.hostWs === ws) customRooms.delete(ws.roomCode);
          else if (room.guestWs === ws) room.guestWs = null;
        }
        ws.roomCode = null;
      }

      // ─── 2. Ranked Matchmaking Queue (±150 MMR) ───
      if (msg.type === 'FIND_MATCH') {
        const playerUser = ws.user; // Server-verified identity only

        // Clean out any stale socket references for this user
        rankedQueue = rankedQueue.filter(p => p.ws !== ws && p.ws.readyState === 1);

        // Find match within ±150 MMR or waiting > 4s
        const now = Date.now();
        const opponentEntry = rankedQueue.find(p => {
          const mmrDiff = Math.abs((p.user.mmr || 500) - (playerUser.mmr || 500));
          const waitTime = now - p.joinedAt;
          return mmrDiff <= 150 || waitTime > 4000;
        });

        if (opponentEntry) {
          rankedQueue = rankedQueue.filter(p => p !== opponentEntry);
          const p1 = opponentEntry.ws;
          const p2 = ws;

          p1.opponent = p2;
          p2.opponent = p1;

          const matchId = 'm_' + Math.random().toString(36).substring(2, 10);
          const paragraph = getRandomQuote();
          const matchNow = Date.now();

          const session = {
            id: matchId,
            p1,
            p2,
            paragraph,
            matchStartSentAt: matchNow,
            p1Stats: null,
            p2Stats: null,
            isResolved: false,
            isRanked: true
          };

          p1.firstKeyAt = null;
          p1.lastKeyAt = null;
          p2.firstKeyAt = null;
          p2.lastKeyAt = null;

          p1.matchSession = session;
          p2.matchSession = session;
          activeMatches.set(matchId, session);

          p1.send(JSON.stringify({ type: 'MATCH_START', paragraph, role: 'p1', matchId, isRanked: true, opponentUser: p2.user }));
          p2.send(JSON.stringify({ type: 'MATCH_START', paragraph, role: 'p2', matchId, isRanked: true, opponentUser: p1.user }));
        } else {
          rankedQueue.push({ ws, user: playerUser, joinedAt: Date.now() });
          ws.send(JSON.stringify({ type: 'WAITING', message: `Searching for rival near ${playerUser.mmr || 500} MMR...` }));
        }
      }

      // ─── 3. Cancel Queue ───
      if (msg.type === 'CANCEL_QUEUE') {
        rankedQueue = rankedQueue.filter(p => p.ws !== ws);
      }

      // ─── 4. Continuous Keystroke Cadence Telemetry Stream (<30ms) ───
      if (msg.type === 'PROGRESS') {
        const now = Date.now();
        const charIdx = parseInt(msg.charIndex) || 0;
        const quoteLen = (ws.matchSession && ws.matchSession.paragraph) ? ws.matchSession.paragraph.length : 100;

        // Record arrival timestamp of the first keystroke
        if (charIdx > 0 && !ws.firstKeyAt) {
          ws.firstKeyAt = now;
        }

        // Record arrival timestamp when the final character is reached
        if (charIdx >= quoteLen && !ws.lastKeyAt) {
          ws.lastKeyAt = now;
        }

        if (ws.opponent && ws.opponent.readyState === 1) {
          ws.opponent.send(JSON.stringify({
            type: 'OPPONENT_PROGRESS',
            charIndex: charIdx,
            wpm: msg.wpm
          }));
        }
      }

      // ─── 5. Race Finish & Resolution (Cadence Stream Anti-Cheat) ───
      if (msg.type === 'FINISH') {
        const session = ws.matchSession;
        if (!session) return;

        const now = Date.now();
        if (!ws.lastKeyAt) ws.lastKeyAt = now;
        if (!ws.firstKeyAt) ws.firstKeyAt = (session.matchStartSentAt || now) + 1800;

        const quoteLen = session.paragraph ? session.paragraph.length : 100;
        let measuredDurationMs = Math.max(300, ws.lastKeyAt - ws.firstKeyAt);

        // Physiological human limit: minimum 35ms per character (~280 WPM physical ceiling)
        const minHumanDuration = quoteLen * 35;
        if (measuredDurationMs < minHumanDuration) {
          console.warn(`[Anti-Cheat] Burst cadence flagged for user ${ws.user?.id}: ${measuredDurationMs}ms for ${quoteLen} chars (clamped to min physical duration: ${minHumanDuration}ms)`);
          measuredDurationMs = minHumanDuration;
        }

        // 100% Server-Derived True WPM
        const serverDerivedWpm = Math.min(240, Math.round(((quoteLen / 5) / (measuredDurationMs / 60000))));
        let claimedAcc = Math.min(100, Math.max(0, parseInt(msg.stats?.accuracy) || 0));

        const sanitizedStats = {
          wpm: serverDerivedWpm,
          accuracy: claimedAcc,
          timeMs: measuredDurationMs
        };

        if (ws.opponent && ws.opponent.readyState === 1) {
          ws.opponent.send(JSON.stringify({
            type: 'OPPONENT_FINISHED',
            stats: sanitizedStats
          }));
        }

        if (session && !session.isResolved) {
          if (session.p1 === ws) session.p1Stats = sanitizedStats;
          if (session.p2 === ws) session.p2Stats = sanitizedStats;

          const resolveMatch = () => {
            if (session.isResolved) return;
            session.isResolved = true;

            const p1 = session.p1;
            const p2 = session.p2;
            const s1 = session.p1Stats || { timeMs: 999999, wpm: 0, accuracy: 0 };
            const s2 = session.p2Stats || { timeMs: 999999, wpm: 0, accuracy: 0 };

            const p1Won = s1.timeMs <= s2.timeMs;
            const winnerWs = p1Won ? p1 : p2;
            const loserWs = p1Won ? p2 : p1;
            const winnerStats = p1Won ? s1 : s2;
            const loserStats = p1Won ? s2 : s1;

            if (session.isRanked) {
              const { winnerDelta, loserDelta, bonuses } = computeMmrDeltas(winnerWs.user, loserWs.user, winnerStats, loserStats);

              // Update SQLite database for ranked
              if (winnerWs.user && winnerWs.user.id && !winnerWs.user.id.startsWith('guest_')) {
                db.updateUserStats(winnerWs.user.id, { mmrDelta: winnerDelta, wpm: winnerStats.wpm, acc: winnerStats.accuracy, won: true });
              }
              if (loserWs.user && loserWs.user.id && !loserWs.user.id.startsWith('guest_')) {
                db.updateUserStats(loserWs.user.id, { mmrDelta: loserDelta, wpm: loserStats.wpm, acc: loserStats.accuracy, won: false });
              }

              if (p1.user && p2.user && !p1.user.id.startsWith('guest_') && !p2.user.id.startsWith('guest_')) {
                db.recordMatch({
                  id: session.id,
                  p1_id: p1.user.id,
                  p2_id: p2.user.id,
                  winner_id: winnerWs.user.id,
                  p1_wpm: s1.wpm || 0,
                  p2_wpm: s2.wpm || 0,
                  p1_acc: s1.accuracy || 0,
                  p2_acc: s2.accuracy || 0,
                  p1_mmr_delta: p1Won ? winnerDelta : loserDelta,
                  p2_mmr_delta: !p1Won ? winnerDelta : loserDelta,
                  quote_text: session.paragraph,
                  is_ranked: 1
                });
              }

              const updatedWinnerUser = (winnerWs.user && !winnerWs.user.id.startsWith('guest_')) ? db.getUserById(winnerWs.user.id) : { ...winnerWs.user, mmr: Math.max(0, (winnerWs.user?.mmr || 500) + winnerDelta) };
              const updatedLoserUser = (loserWs.user && !loserWs.user.id.startsWith('guest_')) ? db.getUserById(loserWs.user.id) : { ...loserWs.user, mmr: Math.max(0, (loserWs.user?.mmr || 500) + loserDelta) };

              if (winnerWs.readyState === 1) {
                winnerWs.send(JSON.stringify({ type: 'MATCH_RESULT', won: true, mmrDelta: winnerDelta, isRanked: true, user: updatedWinnerUser, bonuses }));
              }
              if (loserWs.readyState === 1) {
                loserWs.send(JSON.stringify({ type: 'MATCH_RESULT', won: false, mmrDelta: loserDelta, isRanked: true, user: updatedLoserUser, bonuses: [] }));
              }
            } else {
              // Custom Unranked Room — 0 MMR Delta (Log match with is_ranked: 0, 0 MMR delta)
              if (p1.user && p1.user.id) {
                db.createGuestUser({ id: p1.user.id, username: p1.user.username || 'Guest 1', avatarUrl: p1.user.avatar_url || null });
              }
              if (p2.user && p2.user.id) {
                db.createGuestUser({ id: p2.user.id, username: p2.user.username || 'Guest 2', avatarUrl: p2.user.avatar_url || null });
              }

              if (p1.user && p2.user) {
                db.recordMatch({
                  id: session.id,
                  p1_id: p1.user.id,
                  p2_id: p2.user.id,
                  winner_id: winnerWs.user ? winnerWs.user.id : null,
                  p1_wpm: s1.wpm || 0,
                  p2_wpm: s2.wpm || 0,
                  p1_acc: s1.accuracy || 0,
                  p2_acc: s2.accuracy || 0,
                  p1_mmr_delta: 0,
                  p2_mmr_delta: 0,
                  quote_text: session.paragraph,
                  is_ranked: 0
                });
              }

              if (winnerWs.readyState === 1) {
                winnerWs.send(JSON.stringify({ type: 'MATCH_RESULT', won: true, mmrDelta: 0, isRanked: false, user: winnerWs.user, bonuses: ['🎮 Custom Duel (0 MMR)'] }));
              }
              if (loserWs.readyState === 1) {
                loserWs.send(JSON.stringify({ type: 'MATCH_RESULT', won: false, mmrDelta: 0, isRanked: false, user: loserWs.user, bonuses: ['🎮 Custom Duel (0 MMR)'] }));
              }
            }
          };

          if (session.p1Stats && session.p2Stats) {
            resolveMatch();
          } else {
            setTimeout(resolveMatch, 7000);
          }
        }
      }
    } catch (err) {
      console.error('WS Error:', err);
    }
  });

  // ─── 6. Cleanup on Disconnect / Forfeit ───
  ws.on('close', () => {
    rankedQueue = rankedQueue.filter(p => p.ws !== ws);

    if (ws.roomCode && customRooms.has(ws.roomCode)) {
      const room = customRooms.get(ws.roomCode);
      if (room.hostWs === ws) {
        if (room.guestWs && room.guestWs.readyState === 1) {
          room.guestWs.send(JSON.stringify({ type: 'ROOM_CLOSED', message: 'Host closed the room.' }));
        }
        customRooms.delete(ws.roomCode);
      } else if (room.guestWs === ws) {
        room.guestWs = null;
        if (room.hostWs && room.hostWs.readyState === 1) {
          room.hostWs.send(JSON.stringify({ type: 'GUEST_LEFT', message: 'Friend left the room.' }));
        }
      }
    }

    const session = ws.matchSession;
    if (session && !session.isResolved && ws.opponent && ws.opponent.readyState === 1) {
      session.isResolved = true;
      const winnerWs = ws.opponent;

      if (session.isRanked) {
        const { winnerDelta } = computeMmrDeltas(winnerWs.user, ws.user, { wpm: 70, accuracy: 100, timeMs: 1000 }, { timeMs: 999999, wpm: 0, accuracy: 0 });
        
        if (winnerWs.user && !winnerWs.user.id.startsWith('guest_')) {
          db.updateUserStats(winnerWs.user.id, { mmrDelta: winnerDelta, wpm: 0, acc: 100, won: true });
        }
        if (ws.user && !ws.user.id.startsWith('guest_')) {
          db.updateUserStats(ws.user.id, { mmrDelta: -15, wpm: 0, acc: 0, won: false });
        }

        const updatedWinner = (winnerWs.user && !winnerWs.user.id.startsWith('guest_')) ? db.getUserById(winnerWs.user.id) : { ...winnerWs.user, mmr: (winnerWs.user?.mmr || 500) + winnerDelta };
        winnerWs.send(JSON.stringify({
          type: 'OPPONENT_DISCONNECTED',
          matchResult: {
            won: true,
            mmrDelta: winnerDelta,
            isRanked: true,
            user: updatedWinner,
            bonuses: ['Rival Forfeit (+25)']
          }
        }));
      } else {
        winnerWs.send(JSON.stringify({
          type: 'OPPONENT_DISCONNECTED',
          matchResult: {
            won: true,
            mmrDelta: 0,
            isRanked: false,
            user: winnerWs.user,
            bonuses: ['Rival Left Room']
          }
        }));
      }
    }
  });
});

server.listen(PORT, () => {
  console.log(`⚡ SYNTAX//RUSH Relay Server running on http://localhost:${PORT}`);
});
