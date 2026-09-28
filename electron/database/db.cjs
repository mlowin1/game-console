const Database = require('better-sqlite3')
const path = require('path')
const { app } = require('electron')

let db

function initializeDatabase() {
  const dbPath = path.join(app.getPath('userData'), 'launcher.db')

  db = new Database(dbPath)

  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  createTables()

  console.log(`Database initialized: ${dbPath}`)

  return db
}

function createTables() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS games (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      cover_image TEXT,
      hero_image TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS game_sources (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      game_id INTEGER NOT NULL,
      store TEXT NOT NULL,
      store_game_id TEXT NOT NULL,
      owned INTEGER NOT NULL DEFAULT 1,

      FOREIGN KEY (game_id)
        REFERENCES games(id)
        ON DELETE CASCADE,

      UNIQUE(store, store_game_id)
    );

    CREATE TABLE IF NOT EXISTS installations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      game_source_id INTEGER NOT NULL,
      install_state TEXT NOT NULL DEFAULT 'not_installed',
      install_path TEXT,
      launch_method TEXT,
      launch_target TEXT,

      FOREIGN KEY (game_source_id)
        REFERENCES game_sources(id)
        ON DELETE CASCADE,

      UNIQUE(game_source_id)
    );
  `)
}

function getDatabase() {
  if (!db) {
    throw new Error('Database has not been initialized.')
  }

  return db
}

module.exports = {
  initializeDatabase,
  getDatabase,
}
