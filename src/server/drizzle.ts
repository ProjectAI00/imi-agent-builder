import { sql } from 'drizzle-orm';
import { drizzle as drizzleNeon } from 'drizzle-orm/neon-http';
import { drizzle as drizzleSqlite } from 'drizzle-orm/better-sqlite3';
import { createSchemaSQL } from './schema';

let db: any;

export function getDb() {
  if (db) return db;
  const url = process.env.DATABASE_URL;
  if (url && url.startsWith('postgres')) {
    const { neon } = require('@neondatabase/serverless');
    const client = neon(url);
    db = drizzleNeon(client);
  } else {
    const Database = require('better-sqlite3');
    const path = require('path');
    const fs = require('fs');
    const dataDir = path.join(process.cwd(), '.data');
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
    const file = path.join(dataDir, 'pinterest_cache.db');
    const client = new Database(file);
    db = drizzleSqlite(client);
  }
  return db;
}

export async function ensureSchema() {
  const d = getDb();
  // drizzle's execute works for both drivers
  await d.execute(createSchemaSQL);
}

