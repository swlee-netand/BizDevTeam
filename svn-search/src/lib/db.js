import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.join(process.cwd(), 'svn-search.db');
const db = new Database(dbPath);

// Initialize Schema
db.exec(`
  CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    path TEXT NOT NULL,
    last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS metadata (
    key TEXT PRIMARY KEY,
    value TEXT
  );
`);

// Ensure last_sync_timestamp exists
const stmt = db.prepare('INSERT OR IGNORE INTO metadata (key, value) VALUES (?, ?)');
stmt.run('last_sync_timestamp', null);

export default db;
