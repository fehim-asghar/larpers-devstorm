const path = require('path');
const fs = require('fs');
const { createClient } = require('@libsql/client');

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

const isTurso = Boolean(process.env.TURSO_DATABASE_URL);
const url = process.env.TURSO_DATABASE_URL || `file:${path.join(__dirname, 'syntax-rush.db')}`;
const authToken = process.env.TURSO_AUTH_TOKEN || undefined;

const client = createClient({
  url,
  authToken,
});

// ══════════════════════════════════════════════════════
// 1. Schema Initialization (CREATE IF NOT EXISTS)
// ══════════════════════════════════════════════════════
let initPromise = null;
async function initDb() {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    try {
      await client.batch([
        `CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          google_id TEXT UNIQUE,
          username TEXT NOT NULL,
          avatar_url TEXT,
          mmr INTEGER DEFAULT 500,
          best_wpm INTEGER DEFAULT 0,
          avg_accuracy REAL DEFAULT 100.0,
          matches_played INTEGER DEFAULT 0,
          matches_won INTEGER DEFAULT 0,
          win_streak INTEGER DEFAULT 0,
          current_tier INTEGER DEFAULT 1,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`,
        `CREATE TABLE IF NOT EXISTS matches (
          id TEXT PRIMARY KEY,
          p1_id TEXT NOT NULL REFERENCES users(id),
          p2_id TEXT NOT NULL REFERENCES users(id),
          winner_id TEXT REFERENCES users(id),
          p1_wpm INTEGER NOT NULL,
          p2_wpm INTEGER NOT NULL,
          p1_acc REAL NOT NULL,
          p2_acc REAL NOT NULL,
          p1_mmr_delta INTEGER DEFAULT 0,
          p2_mmr_delta INTEGER DEFAULT 0,
          quote_text TEXT NOT NULL,
          is_ranked INTEGER DEFAULT 1,
          played_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`,
        `CREATE TABLE IF NOT EXISTS ghost_runs (
          id TEXT PRIMARY KEY,
          user_id TEXT REFERENCES users(id),
          quote_text TEXT NOT NULL,
          wpm INTEGER NOT NULL,
          accuracy REAL NOT NULL,
          time_ms INTEGER NOT NULL,
          timeline_json TEXT NOT NULL,
          recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`,
        `CREATE TABLE IF NOT EXISTS sessions (
          token TEXT PRIMARY KEY,
          user_id TEXT NOT NULL REFERENCES users(id),
          expires_at INTEGER NOT NULL
        )`,
        `CREATE INDEX IF NOT EXISTS idx_users_mmr ON users(mmr DESC)`,
        `CREATE INDEX IF NOT EXISTS idx_ghost_quote ON ghost_runs(quote_text, wpm DESC)`,
        `CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at)`
      ], 'write');

      // Auto-migration: ensure win_streak and current_tier columns exist
      try {
        await client.execute(`ALTER TABLE users ADD COLUMN win_streak INTEGER DEFAULT 0;`);
      } catch (e) {}
      try {
        await client.execute(`ALTER TABLE users ADD COLUMN current_tier INTEGER DEFAULT 1;`);
      } catch (e) {}

      console.log(`📦 Database Connected: ${isTurso ? 'Turso Cloud SQLite (' + url + ')' : 'Local SQLite (' + url + ')'}`);
    } catch (err) {
      console.error('❌ Database initialization error:', err);
    }
  })();
  return initPromise;
}

// Automatically trigger init on module load
initDb();

// ══════════════════════════════════════════════════════
// 2. Helper Methods (Async LibSQL Queries)
// ══════════════════════════════════════════════════════

module.exports = {
  client,
  initDb,

  // ─── Sessions (Persistent Auth) ───
  async createSession(token, userId, expiresAt) {
    await initDb();
    return client.execute({
      sql: 'INSERT OR REPLACE INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)',
      args: [token, userId, expiresAt]
    });
  },

  async getSession(token) {
    if (!token) return null;
    await initDb();
    const res = await client.execute({
      sql: 'SELECT * FROM sessions WHERE token = ?',
      args: [token]
    });
    return res.rows[0] || null;
  },

  async deleteSession(token) {
    if (!token) return;
    await initDb();
    return client.execute({
      sql: 'DELETE FROM sessions WHERE token = ?',
      args: [token]
    });
  },

  async cleanExpiredSessions() {
    await initDb();
    return client.execute({
      sql: 'DELETE FROM sessions WHERE expires_at < ?',
      args: [Date.now()]
    });
  },

  // ─── Users ───
  async getUserById(id) {
    if (!id) return null;
    await initDb();
    const res = await client.execute({
      sql: 'SELECT * FROM users WHERE id = ?',
      args: [id]
    });
    return res.rows[0] || null;
  },

  async getUserByGoogleId(googleId) {
    if (!googleId) return null;
    await initDb();
    const res = await client.execute({
      sql: 'SELECT * FROM users WHERE google_id = ?',
      args: [googleId]
    });
    return res.rows[0] || null;
  },

  async createGuestUser({ id, username, avatarUrl = null, mmr = 0, currentTier = 1 }) {
    await initDb();
    const existing = await module.exports.getUserById(id);
    if (existing) return existing;
    await client.execute({
      sql: `INSERT INTO users (id, google_id, username, avatar_url, mmr, best_wpm, avg_accuracy, win_streak, current_tier)
            VALUES (?, NULL, ?, ?, ?, 0, 100.0, 0, ?)`,
      args: [id, username, avatarUrl, mmr, currentTier || 1]
    });
    return module.exports.getUserById(id);
  },

  async upsertGoogleUser({ googleId, username, avatarUrl }) {
    await initDb();
    let existing = await module.exports.getUserByGoogleId(googleId);
    if (existing) {
      if (avatarUrl && avatarUrl !== existing.avatar_url) {
        await client.execute({
          sql: 'UPDATE users SET avatar_url = ?, username = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
          args: [avatarUrl, username || existing.username, existing.id]
        });
        existing = await module.exports.getUserById(existing.id);
      }
      return existing;
    }
    const id = 'usr_' + Math.random().toString(36).substring(2, 10);
    await client.execute({
      sql: `INSERT INTO users (id, google_id, username, avatar_url, mmr, best_wpm, avg_accuracy, win_streak, current_tier)
            VALUES (?, ?, ?, ?, 0, 0, 100.0, 0, 1)`,
      args: [id, googleId, username || 'Racer_' + id.slice(-4), avatarUrl]
    });
    return module.exports.getUserById(id);
  },

  async updateUserStats(userId, { mmrDelta, wpm, acc, won }) {
    await initDb();
    return client.execute({
      sql: `UPDATE users SET
        mmr = MAX(0, mmr + ?),
        best_wpm = MAX(best_wpm, ?),
        avg_accuracy = ROUND(((avg_accuracy * matches_played) + ?) / (matches_played + 1), 1),
        matches_played = matches_played + 1,
        matches_won = matches_won + ?,
        win_streak = CASE WHEN ? = 1 THEN win_streak + 1 ELSE 0 END,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?`,
      args: [
        mmrDelta || 0,
        wpm || 0,
        acc || 100.0,
        won ? 1 : 0,
        won ? 1 : 0,
        userId
      ]
    });
  },

  async updateUserTier(userId, tier) {
    await initDb();
    const targetTier = Math.max(1, Math.min(3, parseInt(tier) || 1));
    return client.execute({
      sql: `UPDATE users SET current_tier = MAX(current_tier, ?), updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      args: [targetTier, userId]
    });
  },

  async getLeaderboard(limit = 50) {
    await initDb();
    const res = await client.execute({
      sql: `SELECT id, username, avatar_url, mmr, best_wpm, avg_accuracy, matches_played, matches_won, win_streak, current_tier
            FROM users
            WHERE id NOT LIKE 'guest_%'
            ORDER BY mmr DESC, best_wpm DESC, matches_won DESC
            LIMIT ?`,
      args: [limit]
    });
    return res.rows;
  },

  // ─── Matches ───
  async recordMatch(match) {
    await initDb();
    return client.execute({
      sql: `INSERT INTO matches (
        id, p1_id, p2_id, winner_id, p1_wpm, p2_wpm, p1_acc, p2_acc,
        p1_mmr_delta, p2_mmr_delta, quote_text, is_ranked
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        match.id,
        match.p1_id,
        match.p2_id,
        match.winner_id,
        match.p1_wpm,
        match.p2_wpm,
        match.p1_acc,
        match.p2_acc,
        match.p1_mmr_delta || 0,
        match.p2_mmr_delta || 0,
        match.quote_text,
        match.is_ranked ? 1 : 0
      ]
    });
  },

  async getRecentMatches(userId = null, limit = 20) {
    await initDb();
    const res = await client.execute({
      sql: `SELECT 
        m.id,
        m.p1_id,
        m.p2_id,
        m.winner_id,
        m.p1_wpm,
        m.p2_wpm,
        m.p1_acc,
        m.p2_acc,
        m.p1_mmr_delta,
        m.p2_mmr_delta,
        m.quote_text,
        m.is_ranked,
        m.played_at,
        u1.username as p1_name,
        u1.avatar_url as p1_avatar,
        u2.username as p2_name,
        u2.avatar_url as p2_avatar
      FROM matches m
      LEFT JOIN users u1 ON m.p1_id = u1.id
      LEFT JOIN users u2 ON m.p2_id = u2.id
      WHERE (? IS NULL OR m.p1_id = ? OR m.p2_id = ?)
      ORDER BY m.played_at DESC
      LIMIT ?`,
      args: [userId || null, userId || null, userId || null, limit]
    });
    return res.rows.map(r => ({
      ...r,
      isRanked: Boolean(r.is_ranked),
      badge: r.is_ranked ? 'RANKED' : 'CUSTOM'
    }));
  },

  // ─── Ghosts ───
  async saveGhostRun(run) {
    await initDb();
    return client.execute({
      sql: `INSERT INTO ghost_runs (id, user_id, quote_text, wpm, accuracy, time_ms, timeline_json)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args: [run.id, run.user_id, run.quote_text, run.wpm, run.accuracy, run.time_ms, run.timeline_json]
    });
  },

  async getBestGhost(quoteText) {
    await initDb();
    const res = await client.execute({
      sql: `SELECT g.*, u.username as runner_name
            FROM ghost_runs g
            LEFT JOIN users u ON g.user_id = u.id
            WHERE g.quote_text = ?
            ORDER BY g.wpm DESC, g.accuracy DESC, g.time_ms ASC
            LIMIT 1`,
      args: [quoteText]
    });
    return res.rows[0] || null;
  },

  // ─── Admin / Overview Stats ───
  async getStats() {
    await initDb();
    const usersRes = await client.execute("SELECT COUNT(*) as count FROM users WHERE id NOT LIKE 'guest_%'");
    const matchesRes = await client.execute("SELECT COUNT(*) as count FROM matches");
    const recentRes = await client.execute("SELECT id, username, avatar_url, mmr, current_tier, created_at FROM users WHERE id NOT LIKE 'guest_%' ORDER BY created_at DESC LIMIT 10");
    return {
      totalUsers: usersRes.rows[0] ? usersRes.rows[0].count : 0,
      totalMatches: matchesRes.rows[0] ? matchesRes.rows[0].count : 0,
      recentUsers: recentRes.rows
    };
  }
};
