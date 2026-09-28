const {
  getDatabase,
} = require('../database/db.cjs')

const {
  getSteamMetadata,
} = require('./steam-metadata-service.cjs')

async function refreshSteamMetadata() {
  const db = getDatabase()

  const sources = db.prepare(`
    SELECT
      gs.game_id,
      gs.store_game_id
    FROM game_sources gs
    WHERE gs.store = 'steam'
  `).all()

  let updated = 0
  let failed = 0

  for (const source of sources) {
    try {
      const metadata =
        await getSteamMetadata(
          source.store_game_id
        )

      if (!metadata) {
        console.warn(
          `No Steam metadata for ${source.store_game_id}`
        )

        failed += 1
        continue
      }

      db.prepare(`
        UPDATE games
        SET
          description = COALESCE(?, description),
          cover_image = COALESCE(?, cover_image),
          hero_image = COALESCE(?, hero_image),
          logo_image = COALESCE(?, logo_image)
        WHERE id = ?
      `).run(
        metadata.description,
        metadata.coverImage,
        metadata.heroImage,
        metadata.logoImage,
        source.game_id
      )

      console.log(
        `Updated metadata: ${metadata.title}`
      )

      updated += 1
    } catch (error) {
      console.error(
        `Failed Steam metadata for ${source.store_game_id}:`,
        error.message
      )

      failed += 1
    }
  }

  return {
    updated,
    failed,
  }
}

module.exports = {
  refreshSteamMetadata,
}
