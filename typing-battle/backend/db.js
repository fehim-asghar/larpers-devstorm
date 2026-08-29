const path = require('path');
const Database = require('better-sqlite3');

const DB_PATH = path.join(__dirname, 'syntax-rush.db');
const db = new Database(DB_PATH);

// Enable WAL mode & foreign keys for ultra-fast concurrent performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ══════════════════════════════════════════════════════
// 1. Schema Initialization (CREATE IF NOT EXISTS)
// ══════════════════════════════════════════════════════
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
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
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS matches (
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
  );

  CREATE TABLE IF NOT EXISTS ghost_runs (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users(id),
    quote_text TEXT NOT NULL,
    wpm INTEGER NOT NULL,
    accuracy REAL NOT NULL,
    time_ms INTEGER NOT NULL,
    timeline_json TEXT NOT NULL,
    recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_users_mmr ON users(mmr DESC);
  CREATE INDEX IF NOT EXISTS idx_ghost_quote ON ghost_runs(quote_text, wpm DESC);
`);

// Auto-migration: ensure win_streak column exists on existing DB files
try {
  db.exec(`ALTER TABLE users ADD COLUMN win_streak INTEGER DEFAULT 0;`);
} catch (e) {
  // Column already exists
}

const tableNames = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all().map(t => t.name);
console.log(`📦 SQLite Connected: ${path.basename(DB_PATH)} [Tables verified: ${tableNames.join(', ')}]`);

// ══════════════════════════════════════════════════════
// 2. Prepared Statements & Helper Methods
// ══════════════════════════════════════════════════════

// ─── Users ───
const stmts = {
  getUserById: db.prepare('SELECT * FROM users WHERE id = ?'),
  getUserByGoogleId: db.prepare('SELECT * FROM users WHERE google_id = ?'),
  insertUser: db.prepare(`
    INSERT INTO users (id, google_id, username, avatar_url, mmr, best_wpm, avg_accuracy, win_streak)
    VALUES (@id, @google_id, @username, @avatar_url, @mmr, @best_wpm, @avg_accuracy, 0)
  `),
  updateUserStats: db.prepare(`
    UPDATE users SET
      mmr = MAX(0, mmr + @mmrDelta),
      best_wpm = MAX(best_wpm, @wpm),
      avg_accuracy = ROUND(((avg_accuracy * matches_played) + @acc) / (matches_played + 1), 1),
      matches_played = matches_played + 1,
      matches_won = matches_won + @won,
      win_streak = CASE WHEN @won = 1 THEN win_streak + 1 ELSE 0 END,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = @userId
  `),
  getLeaderboard: db.prepare(`
    SELECT id, username, avatar_url, mmr, best_wpm, avg_accuracy, matches_played, matches_won, win_streak
    FROM users
    ORDER BY mmr DESC, best_wpm DESC
    LIMIT ?
  `),
  // ─── Matches ───
  insertMatch: db.prepare(`
    INSERT INTO matches (
      id, p1_id, p2_id, winner_id, p1_wpm, p2_wpm, p1_acc, p2_acc,
      p1_mmr_delta, p2_mmr_delta, quote_text, is_ranked
    ) VALUES (
      @id, @p1_id, @p2_id, @winner_id, @p1_wpm, @p2_wpm, @p1_acc, @p2_acc,
      @p1_mmr_delta, @p2_mmr_delta, @quote_text, @is_ranked
    )
  `),
  getRecentMatches: db.prepare(`
    SELECT 
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
    WHERE (@userId IS NULL OR m.p1_id = @userId OR m.p2_id = @userId)
    ORDER BY m.played_at DESC
    LIMIT @limit
  `),
  // ─── Ghosts ───
  insertGhost: db.prepare(`
    INSERT INTO ghost_runs (id, user_id, quote_text, wpm, accuracy, time_ms, timeline_json)
    VALUES (@id, @user_id, @quote_text, @wpm, @accuracy, @time_ms, @timeline_json)
  `),
  getBestGhost: db.prepare(`
    SELECT g.*, u.username as runner_name
    FROM ghost_runs g
    LEFT JOIN users u ON g.user_id = u.id
    WHERE g.quote_text = ?
    ORDER BY g.wpm DESC, g.accuracy DESC, g.time_ms ASC
    LIMIT 1
  `)
};

module.exports = {
  db,
  getUserById(id) {
    return stmts.getUserById.get(id);
  },
  getUserByGoogleId(googleId) {
    return stmts.getUserByGoogleId.get(googleId);
  },
  createGuestUser({ id, username, avatarUrl = null, mmr = 500 }) {
    const existing = stmts.getUserById.get(id);
    if (existing) return existing;
    stmts.insertUser.run({
      id,
      google_id: null,
      username,
      avatar_url: avatarUrl,
      mmr,
      best_wpm: 0,
      avg_accuracy: 100.0
    });
    return stmts.getUserById.get(id);
  },
  upsertGoogleUser({ googleId, username, avatarUrl }) {
    let existing = stmts.getUserByGoogleId.get(googleId);
    if (existing) {
      if (avatarUrl && avatarUrl !== existing.avatar_url) {
        db.prepare('UPDATE users SET avatar_url = ?, username = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
          .run(avatarUrl, username || existing.username, existing.id);
        existing = stmts.getUserById.get(existing.id);
      }
      return existing;
    }
    const id = 'usr_' + Math.random().toString(36).substring(2, 10);
    stmts.insertUser.run({
      id,
      google_id: googleId,
      username: username || 'Racer_' + id.slice(-4),
      avatar_url: avatarUrl,
      mmr: 500,
      best_wpm: 0,
      avg_accuracy: 100.0
    });
    return stmts.getUserById.get(id);
  },
  updateUserStats(userId, { mmrDelta, wpm, acc, won }) {
    return stmts.updateUserStats.run({
      userId,
      mmrDelta: mmrDelta || 0,
      wpm: wpm || 0,
      acc: acc || 100.0,
      won: won ? 1 : 0
    });
  },
  recordMatch(match) {
    return stmts.insertMatch.run(match);
  },
  getRecentMatches(userId = null, limit = 20) {
    const rows = stmts.getRecentMatches.all({ userId: userId || null, limit });
    return rows.map(r => ({
      ...r,
      isRanked: Boolean(r.is_ranked),
      badge: r.is_ranked ? 'RANKED' : 'CUSTOM'
    }));
  },
  getLeaderboard(limit = 50) {
    return stmts.getLeaderboard.all(limit);
  },
  saveGhostRun(run) {
    return stmts.insertGhost.run(run);
  },
  getBestGhost(quoteText) {
    return stmts.getBestGhost.get(quoteText);
  }
};
