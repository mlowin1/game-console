const {
  getDatabase,
} = require('../../database/db.cjs')

function importOwnedSteamGames(ownedGames) {
  const db = getDatabase()

  let added = 0
  let updated = 0

  const importLibrary = db.transaction(() => {
    for (const steamGame of ownedGames) {
      let source = db.prepare(`
        SELECT
          gs.id AS source_id,
          gs.game_id
        FROM game_sources gs
        WHERE gs.store = 'steam'
          AND gs.store_game_id = ?
        LIMIT 1
      `).get(steamGame.appId)

      if (source) {
        db.prepare(`
          UPDATE game_sources
          SET owned = 1
          WHERE id = ?
        `).run(source.source_id)

        updated += 1
        continue
      }

      /*
       * Try to match an existing game by title before
       * creating another game record.
       */
      let game = db.prepare(`
        SELECT id
        FROM games
        WHERE LOWER(TRIM(title)) =
              LOWER(TRIM(?))
        LIMIT 1
      `).get(steamGame.name)

      let gameId

      if (game) {
        gameId = game.id
      } else {
        const result = db.prepare(`
          INSERT INTO games (
            title
          )
          VALUES (?)
        `).run(steamGame.name)

        gameId =
          Number(result.lastInsertRowid)
      }

      const sourceResult = db.prepare(`
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

      const sourceId =
        Number(sourceResult.lastInsertRowid)

      /*
       * Ownership does NOT imply installation.
       *
       * The local Steam scanner is responsible for
       * changing this to "installed" when it finds
       * an appmanifest.
       */
      db.prepare(`
        INSERT INTO installations (
          game_source_id,
          install_state,
          install_path,
          launch_method,
          launch_target
        )
        VALUES (
          ?,
          'not_installed',
          NULL,
          'steam',
          ?
        )
      `).run(
        sourceId,
        `steam://install/${steamGame.appId}`
      )

      added += 1
    }
  })

  importLibrary()

  return {
    total: ownedGames.length,
    added,
    updated,
  }
}

module.exports = {
  importOwnedSteamGames,
}