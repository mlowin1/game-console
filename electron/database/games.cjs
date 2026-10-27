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
      c.verdict AS compat_verdict,
      c.reason AS compat_reason,
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
    LEFT JOIN game_compatibility c ON c.game_id = g.id
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

  const playStats = db.prepare(`
    SELECT
      COUNT(*) AS session_count,
      MAX(started_at) AS last_played_at,
      COALESCE(SUM(
        CASE
          WHEN status = 'exited' AND ended_at IS NOT NULL
            THEN MAX(0, CAST(strftime('%s', ended_at) AS INTEGER)
              - CAST(strftime('%s', started_at) AS INTEGER))
          ELSE 0
        END
      ), 0) AS total_play_seconds
    FROM game_sessions
    WHERE game_id = ?
      AND status IN ('running', 'exited')
  `).get(gameId)

  const providerPlaytime = db.prepare(`
    SELECT COALESCE(SUM(playtime_minutes), 0) AS minutes
    FROM game_sources
    WHERE game_id = ? AND owned = 1
  `).get(gameId).minutes * 60

  const compatibility = db.prepare(`
    SELECT verdict, reason, source, reference_url
    FROM game_compatibility
    WHERE game_id = ?
  `).get(gameId) ?? null

  return {
    ...game,
    sources,
    compatibility,
    session_count: playStats.session_count,
    last_played_at: playStats.last_played_at,
    total_play_seconds: Math.max(
      playStats.total_play_seconds,
      providerPlaytime
    ),
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