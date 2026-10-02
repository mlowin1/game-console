const {
  getDatabase,
} = require('../database/db.cjs')

const {
  installSteamGame,
  uninstallSteamGame,
} = require('../installers/steam.cjs')

const {
  installEpicGame,
  uninstallEpicGame,
} = require('../installers/epic.cjs')

const {
  getSteamInstallStatus,
} = require('./steam-install-status-service.cjs')

const {
  getEpicInstallStatus,
} = require('./epic-service.cjs')

function getPreferredSource(
  gameId
) {
  const db = getDatabase()

  return db.prepare(`
    SELECT
      g.title,
      gs.id AS source_id,
      gs.store,
      gs.store_game_id,
      gs.owned,
      i.install_state,
      i.install_path
    FROM games g
    JOIN game_sources gs
      ON gs.game_id = g.id
    LEFT JOIN installations i
      ON i.game_source_id = gs.id
    WHERE g.id = ?
      AND gs.owned = 1
    ORDER BY
      CASE
        WHEN i.install_state = 'installed'
          THEN 0
        ELSE 1
      END,
      CASE
        WHEN gs.store = 'steam'
          THEN 0
        ELSE 1
      END
    LIMIT 1
  `).get(gameId)
}

function installGame(gameId) {
  const source =
    getPreferredSource(gameId)

  if (!source) {
    return {
      success: false,
      error:
        'No owned game source found',
    }
  }

  console.log(
    `Installing ${source.title} from ${source.store}`
  )

  switch (source.store) {
    case 'steam':
      return installSteamGame(
        source.store_game_id
      )

    case 'epic':
      return installEpicGame(
        source.store_game_id
      )

    default:
      return {
        success: false,
        error:
          `Installation from ${source.store} is not implemented`,
      }
  }
}

function uninstallGame(gameId) {
  const source =
    getPreferredSource(gameId)

  if (!source) {
    return {
      success: false,
      error:
        'No owned game source found',
    }
  }

  if (
    source.install_state !==
    'installed'
  ) {
    return {
      success: false,
      error:
        'Game is not installed',
    }
  }

  console.log(
    `Uninstalling ${source.title} from ${source.store}`
  )

  switch (source.store) {
    case 'steam':
      return uninstallSteamGame(
        source.store_game_id
      )

    case 'epic':
      return uninstallEpicGame(
        source.store_game_id
      )

    default:
      return {
        success: false,
        error:
          `Uninstallation from ${source.store} is not implemented`,
      }
  }
}

async function getGameInstallStatus(
  gameId
) {
  const source =
    getPreferredSource(gameId)

  if (!source) {
    return {
      state: 'not_installed',
      progress: 0,
    }
  }

  switch (source.store) {
    case 'steam':
      return getSteamInstallStatus(
        source.store_game_id
      )

    case 'epic': {
      const status =
        await getEpicInstallStatus(
          source.store_game_id
        )

      return {
        store: 'epic',
        ...status,
      }
    }

    default:
      return {
        state:
          source.install_state ??
          'not_installed',

        progress:
          source.install_state ===
          'installed'
            ? 100
            : 0,
      }
  }
}

module.exports = {
  installGame,
  uninstallGame,
  getGameInstallStatus,
}