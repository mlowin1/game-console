const { getDatabase } = require('./db.cjs')

function getGames() {
  const db = getDatabase()

  const games = db.prepare(`
    SELECT
      g.id,
      g.title,
      g.description,
      g.cover_image,
      g.hero_image,
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

module.exports = {
  getGames,
}
