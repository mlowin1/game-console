import Database from 'better-sqlite3'
import { readFileSync, readdirSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
const base = dirname(fileURLToPath(import.meta.url))
export function openDatabase(filename = process.env.ACCOUNT_DB_PATH || join(base, 'data/accounts.db')) {
  if (filename !== ':memory:') mkdirSync(dirname(filename), { recursive: true })
  const db = new Database(filename)
  db.pragma('foreign_keys = ON')
  db.pragma('journal_mode = WAL')
  db.exec('CREATE TABLE IF NOT EXISTS schema_migrations (version TEXT PRIMARY KEY, applied_at INTEGER NOT NULL)')
  const migrationFiles = readdirSync(join(base,'migrations')).filter(f => /^\d+.*\.sql$/.test(f)).sort()
  for (const filename of migrationFiles) {
    if (db.prepare('SELECT 1 FROM schema_migrations WHERE version = ?').get(filename)) continue
    db.transaction(() => {
      db.exec(readFileSync(join(base,'migrations',filename),'utf8'))
      db.prepare('INSERT INTO schema_migrations VALUES (?,?)').run(filename, Date.now())
    })()
  }
  return db
}
