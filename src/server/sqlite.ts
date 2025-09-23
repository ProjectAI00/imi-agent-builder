import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

let db: Database.Database | null = null;

export function getDb() {
  if (db) return db;

  const dataDir = path.join(process.cwd(), '.data');
  try {
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  } catch {}

  const file = path.join(dataDir, 'pinterest_cache.db');
  db = new Database(file);
  db.pragma('journal_mode = WAL');

  // Schema: users, boards, pins
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT,
      name TEXT,
      updated_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS boards (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      pin_count INTEGER DEFAULT 0,
      created_at TEXT,
      preview_image TEXT,
      updated_at INTEGER,
      FOREIGN KEY(user_id) REFERENCES users(id)
    );

    CREATE INDEX IF NOT EXISTS idx_boards_user ON boards(user_id);

    CREATE TABLE IF NOT EXISTS pins (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      board_id TEXT NOT NULL,
      title TEXT,
      description TEXT,
      link TEXT,
      image_url TEXT,
      image_width INTEGER,
      image_height INTEGER,
      is_video INTEGER DEFAULT 0,
      created_at TEXT,
      updated_at INTEGER,
      FOREIGN KEY(board_id) REFERENCES boards(id),
      FOREIGN KEY(user_id) REFERENCES users(id)
    );

    CREATE INDEX IF NOT EXISTS idx_pins_board ON pins(board_id);
    CREATE INDEX IF NOT EXISTS idx_pins_user ON pins(user_id);
    CREATE INDEX IF NOT EXISTS idx_pins_search ON pins(title, description);
  `);

  return db;
}

