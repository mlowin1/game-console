const { getDatabase } = require('../../database/db.cjs')
const {
  scanSteamInstallation,
} = require('./detector.cjs')

function importSteamLibrary(steamRootPath) {
  const db = getDatabase()
  const snapshot =
    scanSteamInstallation(steamRootPath)

  const discoveredGames = snapshot.games

  const results = []

  const syncLibrary = db.transaction(() => {
    // AppIDs actually installed according to the current Steam scan.
    const discoveredAppIds = new Set(
      discoveredGames.map((game) => game.appId)
    )

    /*
     * Anything we previously knew as an installed Steam game but
     * didn't discover in this scan should now be marked uninstalled.
     */
    const knownSteamInstallations = db.prepare(`
      SELECT
        i.id AS installation_id,
        gs.store_game_id
      FROM installations i
      JOIN game_sources gs
        ON gs.id = i.game_source_id
      WHERE gs.store = 'steam'
    `).all()

    for (const installation of knownSteamInstallations) {
      if (!discoveredAppIds.has(installation.store_game_id)) {
        db.prepare(`
          UPDATE installations
          SET
            install_state = 'not_installed',
            install_path = NULL
          WHERE id = ?
        `).run(installation.installation_id)
      }
    }

    /*
     * Import/update everything we DID discover.
     */
    for (const steamGame of discoveredGames) {
      let source = db.prepare(`
        SELECT
          gs.id AS source_id,
          gs.game_id
        FROM game_sources gs
        WHERE gs.store = 'steam'
          AND gs.store_game_id = ?
        LIMIT 1
      `).get(steamGame.appId)

      let gameId

      if (source) {
        gameId = source.game_id

        db.prepare(`
          UPDATE game_sources
          SET owned = 1
          WHERE id = ?
        `).run(source.source_id)
      } else {
        const existingGame = db.prepare(`
          SELECT id
          FROM games
          WHERE LOWER(TRIM(title)) = LOWER(TRIM(?))
          LIMIT 1
        `).get(steamGame.name)

        if (existingGame) {
          gameId = existingGame.id
        } else {
          const result = db.prepare(`
            INSERT INTO games (
              title,
              description
            )
            VALUES (?, ?)
          `).run(
            steamGame.name,
            `Imported from Steam (AppID ${steamGame.appId})`
          )

          gameId = Number(result.lastInsertRowid)
        }

        const result = db.prepare(`
          INSERT INTO game_sources (
            game_id,
            store,
            store_game_id,
            owned
          )
          VALUES (?, 'steam', ?, 1)
        `).run(
          gameId,
          steamGame.appId
        )

        source = {
          source_id: Number(result.lastInsertRowid),
          game_id: gameId,
        }
      }

      const existingInstallation = db.prepare(`
        SELECT id
        FROM installations
        WHERE game_source_id = ?
        LIMIT 1
      `).get(source.source_id)

      if (existingInstallation) {
        db.prepare(`
          UPDATE installations
          SET
            install_state = 'installed',
            install_path = ?,
            launch_method = 'steam',
            launch_target = ?
          WHERE id = ?
        `).run(
          steamGame.installPath,
          steamGame.launchTarget,
          existingInstallation.id
        )
      } else {
        db.prepare(`
          INSERT INTO installations (
            game_source_id,
            install_state,
            install_path,
            launch_method,
            launch_target
          )
          VALUES (?, 'installed', ?, 'steam', ?)
        `).run(
          source.source_id,
          steamGame.installPath,
          steamGame.launchTarget
        )
      }

      results.push({
        gameId,
        appId: steamGame.appId,
        title: steamGame.name,
      })
    }
  })

  syncLibrary()

  return results
}

module.exports = {
  importSteamLibrary,
}
