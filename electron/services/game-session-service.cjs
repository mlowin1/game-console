const { getDatabase } = require('../database/db.cjs')
const {
  isSteamGameRunning,
} = require('./game-process-service.cjs')

const activeMonitors = new Map()

function createSession(gameId, sourceId) {
  const db = getDatabase()

  const result = db.prepare(`
    INSERT INTO game_sessions (
      game_id,
      source_id,
      status
    )
    VALUES (?, ?, 'launching')
  `).run(gameId, sourceId)

  return Number(result.lastInsertRowid)
}

function updateSessionStatus(sessionId, status) {
  const db = getDatabase()

  db.prepare(`
    UPDATE game_sessions
    SET status = ?
    WHERE id = ?
  `).run(status, sessionId)
}

function endSession(sessionId) {
  const db = getDatabase()

  db.prepare(`
    UPDATE game_sessions
    SET
      status = 'exited',
      ended_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(sessionId)
}

function monitorSteamSession({
  sessionId,
  appId,
  pollInterval = 2000,
  launchTimeout = 30000,
  onStarted,
  onExited,
  onFailed,
}) {
  if (activeMonitors.has(sessionId)) {
    return
  }

  let hasStarted = false
  const startedMonitoringAt = Date.now()

  const timer = setInterval(async () => {
    try {
      const running =
        await isSteamGameRunning(appId)

      if (!hasStarted && running) {
        hasStarted = true

        updateSessionStatus(
          sessionId,
          'running'
        )

        console.log(
          `Steam AppID ${appId} is running`
        )

        if (onStarted) {
          onStarted()
        }

        return
      }

      if (hasStarted && !running) {
        endSession(sessionId)
        clearInterval(timer)
        activeMonitors.delete(sessionId)

        console.log(
          `Steam AppID ${appId} exited`
        )

        if (onExited) {
          onExited()
        }

        return
      }

      if (
        !hasStarted &&
        Date.now() - startedMonitoringAt >= launchTimeout
      ) {
        updateSessionStatus(
          sessionId,
          'failed'
        )

        clearInterval(timer)
        activeMonitors.delete(sessionId)

        console.error(
          `Steam AppID ${appId} did not start within ${launchTimeout}ms`
        )

        if (onFailed) {
          onFailed()
        }
      }
    } catch (error) {
      console.error(
        `Failed to monitor Steam AppID ${appId}:`,
        error
      )
    }
  }, pollInterval)

  activeMonitors.set(sessionId, timer)
}

function getGameRuntimeStatus(gameId) {
  const db = getDatabase()

  const session = db.prepare(`
    SELECT
      id,
      status,
      started_at,
      ended_at
    FROM game_sessions
    WHERE game_id = ?
    ORDER BY id DESC
    LIMIT 1
  `).get(gameId)

  if (!session) {
    return {
      status: 'stopped',
      sessionId: null,
    }
  }

  if (
    session.status !== 'launching' &&
    session.status !== 'running'
  ) {
    return {
      status: 'stopped',
      sessionId: session.id,
    }
  }

  return {
    status: session.status,
    sessionId: session.id,
    startedAt: session.started_at,
  }
}

module.exports = {
  createSession,
  monitorSteamSession,
  getGameRuntimeStatus,
}
