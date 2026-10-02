const { getDatabase } = require('./db.cjs')

function getGames() {
  const db = getDatabase()

  const games = db.prepare(`
    SELECT
      id,
      title,
      description,
      COALESCE(
        g.cover_override,
        g.cover_image
      ) AS cover_image,
      hero_image,
      logo_image,
      COALESCE((
        SELECT GROUP_CONCAT(DISTINCT gs.store)
        FROM game_sources gs
        WHERE gs.game_id = g.id
          AND gs.owned = 1
      ), '') AS stores,
      (
        SELECT MAX(gs.started_at)
        FROM game_sessions gs
        WHERE gs.game_id = g.id
          AND gs.status IN ('running', 'exited')
      ) AS last_played_at,
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
      COALESCE(
        cover_override,
        cover_image
      ) AS cover_image,
      cover_image AS automatic_cover_image,
      cover_override,
      cover_source,
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

function setCoverOverride(
  gameId,
  coverUrl
) {
  const db = getDatabase()

  const result = db.prepare(`
    UPDATE games
    SET cover_override = ?
    WHERE id = ?
  `).run(
    coverUrl,
    gameId
  )

  return result.changes > 0
}

function clearCoverOverride(gameId) {
  const db = getDatabase()

  const result = db.prepare(`
    UPDATE games
    SET cover_override = NULL
    WHERE id = ?
  `).run(gameId)

  return result.changes > 0
}

module.exports = {
  getGames,
  getGameDetails,
  setCoverOverride,
  clearCoverOverride,
}