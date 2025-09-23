import { sql } from 'drizzle-orm';

// Minimal bootstrap schema executed for both SQLite and Postgres
export const createSchemaSQL = sql`
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT,
  name TEXT,
  updated_at BIGINT
);

CREATE TABLE IF NOT EXISTS boards (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  pin_count INTEGER DEFAULT 0,
  created_at TEXT,
  preview_image TEXT,
  updated_at BIGINT
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
  updated_at BIGINT
);

CREATE INDEX IF NOT EXISTS idx_pins_board ON pins(board_id);
CREATE INDEX IF NOT EXISTS idx_pins_user ON pins(user_id);
CREATE INDEX IF NOT EXISTS idx_pins_search ON pins(title, description);
`;

