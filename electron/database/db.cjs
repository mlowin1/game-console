const path = require('path')
const os = require('os')
const fs = require('fs')
const Database = require('better-sqlite3')

let db = null

function getDatabasePath() {
  // Explicit override is useful for tests and development tools.
  if (process.env.LAUNCHER_DB_PATH) {
    return process.env.LAUNCHER_DB_PATH
  }

  // When running inside Electron, use Electron's userData directory.
  if (process.versions.electron) {
    const { app } = require('electron')

    return path.join(
      app.getPath('userData'),
      'launcher.db'
    )
  }

  // When running from plain Node, mirror Electron's Linux
  // user-data location.
  const configHome =
    process.env.XDG_CONFIG_HOME ||
    path.join(os.homedir(), '.config')

  return path.join(
    configHome,
    'game-console',
    'launcher.db'
  )
}

function initializeDatabase() {
  if (db) {
    return db
  }

  const dbPath = getDatabasePath()

  fs.mkdirSync(path.dirname(dbPath), {
    recursive: true,
  })

  console.log(`Database: ${dbPath}`)

  db = new Database(dbPath)

  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  db.exec(`
    CREATE TABLE IF NOT EXISTS games (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      cover_image TEXT,
      hero_image TEXT,
      logo_image TEXT
    );

    CREATE TABLE IF NOT EXISTS game_sources (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      game_id INTEGER NOT NULL,
      store TEXT NOT NULL,
      store_game_id TEXT NOT NULL,
      owned INTEGER NOT NULL DEFAULT 1,
      FOREIGN KEY (game_id)
        REFERENCES games(id)
        ON DELETE CASCADE
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
        ON DELETE CASCADE
    );
 
    CREATE TABLE IF NOT EXISTS game_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      game_id INTEGER NOT NULL,
      source_id INTEGER,
      status TEXT NOT NULL,
      started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      ended_at TEXT,
      FOREIGN KEY (game_id)
        REFERENCES games(id)
        ON DELETE CASCADE,
      FOREIGN KEY (source_id)
        REFERENCES game_sources(id)
        ON DELETE SET NULL
    );
  `)

    /*
    * Lightweight database migrations.
    *
    * CREATE TABLE IF NOT EXISTS does not add new
    * columns to an existing SQLite database, so we
    * explicitly add columns when upgrading an older
    * launcher database.
    */
    const gameColumns =
      db.prepare(`
        PRAGMA table_info(games)
      `).all()

    const gameColumnNames =
      new Set(
        gameColumns.map(
          (column) => column.name
        )
      )

    /*
    * Older databases may not have logo_image.
    */
    if (!gameColumnNames.has('logo_image')) {
      db.exec(`
        ALTER TABLE games
        ADD COLUMN logo_image TEXT
      `)

      console.log(
        'Database migration: added games.logo_image'
      )
    }

    /*
    * Track which provider supplied the cover.
    */
    if (!gameColumnNames.has('cover_source')) {
      db.exec(`
        ALTER TABLE games
        ADD COLUMN cover_source TEXT
      `)

      console.log(
        'Database migration: added games.cover_source'
      )
    }

    /*
    * Track when metadata was last successfully
    * checked so we don't hit APIs every boot.
    */
    if (!gameColumnNames.has('metadata_refreshed_at')) {
      db.exec(`
        ALTER TABLE games
        ADD COLUMN metadata_refreshed_at TEXT
      `)

      console.log(
        'Database migration: added games.metadata_refreshed_at'
      )
    }

    /*
    * Track the result of the most recent metadata
    * refresh.
    */
    if (!gameColumnNames.has('metadata_refresh_status')) {
      db.exec(`
        ALTER TABLE games
        ADD COLUMN metadata_refresh_status TEXT
      `)

      console.log(
        'Database migration: added games.metadata_refresh_status'
      )
    }

      /*
      * Optional user-selected cover artwork.
      *
      * When present, this takes priority over the
      * automatically selected provider artwork.
      */
      if (!gameColumnNames.has('cover_override')) {
        db.exec(`
          ALTER TABLE games
          ADD COLUMN cover_override TEXT
        `)

        console.log(
          'Database migration: added games.cover_override'
        )
      }

  return db
}

function getDatabase() {
  if (!db) {
    return initializeDatabase()
  }

  return db
}

module.exports = {
  initializeDatabase,
  getDatabase,
  getDatabasePath,
}
