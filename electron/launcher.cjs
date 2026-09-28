const { getDatabase } = require('./database/db.cjs')
const { launchNative } = require('./launchers/native.cjs')

function launchGame(gameId) {
  const db = getDatabase()

  const source = db.prepare(`
    SELECT
      g.title,
      gs.store,
      i.install_state,
      i.launch_method,
      i.launch_target
    FROM games g
    JOIN game_sources gs
      ON gs.game_id = g.id
    JOIN installations i
      ON i.game_source_id = gs.id
    WHERE g.id = ?
      AND i.install_state = 'installed'
    ORDER BY i.id
    LIMIT 1
  `).get(gameId)

  if (!source) {
    return {
      success: false,
      error: 'Game is not installed',
    }
  }

  console.log(
    `Launching ${source.title} using ${source.launch_method}`
  )

  try {
    switch (source.launch_method) {
      case 'native':
        return launchNative(source.launch_target)

      case 'steam':
        return {
          success: false,
          error: 'Steam launching is not implemented yet',
        }

      case 'proton':
        return {
          success: false,
          error: 'Proton launching is not implemented yet',
        }

      default:
        return {
          success: false,
          error: `Unsupported launch method: ${source.launch_method}`,
        }
    }
  } catch (error) {
    console.error(`Failed to launch ${source.title}:`, error)

    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Unknown launch error',
    }
  }
}

module.exports = {
  launchGame,
}
