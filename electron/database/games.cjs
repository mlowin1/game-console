const { getDatabase } = require('./db.cjs')

function getGames() {
  const db = getDatabase()

  const games = db.prepare(`
    SELECT
      id,
      title,
      description,
      cover_image,
      hero_image,
      logo_image,
      CASE
        WHEN EXISTS (
          SELECT 1
          FROM game_sources gs
          JOIN installations i
            ON i.game_source_id = gs.id
          WHERE gs.game_id = g.id
            AND i.install_state = 'installed'
        )
        THEN 1
        ELSE 0
      END AS installed
    FROM games g
    ORDER BY g.title
  `).all()

  return games
}

function getGameDetails(gameId) {
  const db = getDatabase()

  const game = db.prepare(`
    SELECT
      id,
      title,
      description,
      cover_image,
      hero_image
    FROM games
    WHERE id = ?
  `).get(gameId)

  if (!game) {
    return null
  }

  const sources = db.prepare(`
    SELECT
      gs.id AS source_id,
      gs.store,
      gs.store_game_id,
      gs.owned,
      i.install_state,
      i.install_path,
      i.launch_method,
      i.launch_target
    FROM game_sources gs
    LEFT JOIN installations i
      ON i.game_source_id = gs.id
    WHERE gs.game_id = ?
    ORDER BY
      CASE WHEN i.install_state = 'installed' THEN 0 ELSE 1 END,
      gs.store
  `).all(gameId)

  return {
    ...game,
    sources,
  }
}

module.exports = {
  getGames,
  getGameDetails,
}
