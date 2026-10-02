const {
  getDatabase,
} = require('../database/db.cjs')

const {
  getSteamInstallStatus,
} = require('./steam-install-status-service.cjs')

async function getGameInstallStatus(gameId) {
  const db = getDatabase()

  const source = db.prepare(`
    SELECT
      g.title,
      gs.store,
      gs.store_game_id,
      gs.owned
    FROM games g
    JOIN game_sources gs
      ON gs.game_id = g.id
    WHERE g.id = ?
      AND gs.owned = 1
    ORDER BY
      CASE
        WHEN gs.store = 'steam'
          THEN 0
        WHEN gs.store = 'epic'
          THEN 1
        ELSE 2
      END
    LIMIT 1
  `).get(gameId)

  if (!source) {
    return {
      state: 'not_installed',
      progress: 0,
      downloadedBytes: 0,
      totalBytes: 0,
      stagedBytes: 0,
      totalStageBytes: 0,
    }
  }

  switch (source.store) {
    case 'steam': {
      const status =
        getSteamInstallStatus(
          source.store_game_id
        )

      return {
        store: 'steam',
        ...status,
      }
    }

    case 'epic': {
      const status =
        await require('./epic-service.cjs')
          .getEpicInstallStatus(
            source.store_game_id
          )

      return {
        store: 'epic',
        ...status,
      }
    }

    default:
      return {
        store: source.store,
        state: 'unknown',
        progress: 0,
        downloadedBytes: 0,
        totalBytes: 0,
        stagedBytes: 0,
        totalStageBytes: 0,
      }
  }
}

module.exports = {
  getGameInstallStatus,
}