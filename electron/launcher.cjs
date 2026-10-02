const { getDatabase } = require('./database/db.cjs')
const { launchNative } = require('./launchers/native.cjs')
const { launchSteam } = require('./launchers/steam.cjs')
const { launchEpic } = require('./launchers/epic.cjs')
const {
  createSession,
  updateSessionStatus,
  endSession,
  monitorSteamSession,
} = require('./services/game-session-service.cjs')

function launchGame(gameId, lifecycle = {}) {
  const db = getDatabase()

  const source = db.prepare(`
    SELECT
      g.title,
      gs.id AS source_id,
      gs.store,
      gs.store_game_id,
      i.install_state,
      i.install_path,
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

      case 'steam': {
        const sessionId = createSession(
          gameId,
          source.source_id
        )

        const result =
          launchSteam(source.launch_target)

        if (!result.success) {
          const db = getDatabase()

          db.prepare(`
            UPDATE game_sessions
            SET
              status = 'failed',
              ended_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `).run(sessionId)

          return result
        }

        monitorSteamSession({
          sessionId,
          appId: source.store_game_id,
          onStarted: lifecycle.onStarted,
          onExited: lifecycle.onExited,
          onFailed: lifecycle.onFailed,
        })

        return {
          ...result,
          sessionId,
        }
      }

      case 'epic': {
        const sessionId = createSession(
          gameId,
          source.source_id
        )

        return launchEpic(source.store_game_id, {
          onStarted: () => {
            updateSessionStatus(sessionId, 'running')
            lifecycle.onStarted?.()
          },
          onExited: () => {
            endSession(sessionId)
            lifecycle.onExited?.()
          },
          onFailed: () => {
            updateSessionStatus(sessionId, 'failed')
            lifecycle.onFailed?.()
          },
        }).then((result) => {
          if (!result.success) {
            updateSessionStatus(sessionId, 'failed')
          }

          return {
            ...result,
            sessionId,
          }
        }, source.install_path)
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
