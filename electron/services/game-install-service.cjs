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
const {
  cancelOperation: cancelEpicOperation,
} = require('../integrations/epic/legendary.cjs')

function updateInstallation(sourceId, state, error = null) {
  getDatabase().prepare(`
    UPDATE installations
    SET install_state = ?, install_error = ?
    WHERE game_source_id = ?
  `).run(state, error, sourceId)
}

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
      i.install_path,
      i.install_error
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

  let result

  switch (source.store) {
    case 'steam':
      result = installSteamGame(
        source.store_game_id
      )
      break

    case 'epic':
      result = installEpicGame(
        source.store_game_id
      )
      break

    default:
      result = {
        success: false,
        error:
          `Installation from ${source.store} is not implemented`,
      }
  }

  updateInstallation(
    source.source_id,
    result.success ? 'installing' : 'failed',
    result.success ? null : result.error
  )

  return {
    ...result,
    store: source.store,
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

  if (
    source.install_state === 'failed' ||
    source.install_state === 'cancelled'
  ) {
    return {
      store: source.store,
      state: source.install_state,
      progress: 0,
      downloadedBytes: 0,
      totalBytes: 0,
      error: source.install_error,
    }
  }

  switch (source.store) {
    case 'steam': {
      const status = getSteamInstallStatus(
        source.store_game_id
      )
      const state =
        status.state === 'not_installed' &&
        source.install_state === 'installing'
          ? 'installing'
          : status.state

      if (state === 'installed' || state === 'downloading') {
        updateInstallation(source.source_id, state)
      }

      return {
        store: 'steam',
        ...status,
        state,
        error: source.install_error,
      }
    }

    case 'epic': {
      const status =
        await getEpicInstallStatus(
          source.store_game_id
        )

      if (status.state === 'unknown' && status.error) {
        updateInstallation(source.source_id, 'failed', status.error)
        return {
          store: 'epic',
          ...status,
          state: 'failed',
        }
      }

      if (status.state === 'installed' || status.state === 'installing') {
        updateInstallation(source.source_id, status.state)
      }

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

async function getDownloadTasks() {
  const db = getDatabase()
  const rows = db.prepare(`
    SELECT
      gs.id AS source_id,
      g.id AS game_id,
      g.title,
      COALESCE(g.cover_override, g.cover_image) AS cover_image,
      gs.store,
      gs.store_game_id,
      i.install_state AS saved_state,
      i.install_error
    FROM installations i
    JOIN game_sources gs ON gs.id = i.game_source_id
    JOIN games g ON g.id = gs.game_id
    WHERE gs.owned = 1
      AND i.install_state IN ('installing', 'downloading', 'failed', 'cancelled')
    ORDER BY
      CASE WHEN i.install_state IN ('installing', 'downloading') THEN 0 ELSE 1 END,
      g.title
  `).all()

  return Promise.all(rows.map(async (row) => {
    if (row.saved_state === 'failed' || row.saved_state === 'cancelled') {
      return {
        ...row,
        state: row.saved_state,
        progress: 0,
        downloadedBytes: 0,
        totalBytes: 0,
        error: row.install_error,
      }
    }

    const status = await getGameInstallStatus(row.game_id)

    if (
      row.saved_state === 'installing' &&
      status.state === 'not_installed'
    ) {
      const error =
        'This install is no longer active. Retry it to start the download again.'
      updateInstallation(row.source_id, 'failed', error)

      return {
        ...row,
        ...status,
        state: 'failed',
        error,
      }
    }

    return {
      ...row,
      ...status,
      state:
        status.state === 'unknown' && status.error
          ? 'failed'
          : status.state,
      error: status.error ?? row.install_error,
    }
  }))
}

function cancelGameInstall(gameId) {
  const source = getPreferredSource(gameId)

  if (!source) {
    return { success: false, error: 'No owned game source found' }
  }

  if (source.store === 'steam') {
    return {
      success: false,
      store: 'steam',
      error: 'Steam manages this download. Cancel it from the Steam client.',
    }
  }

  if (source.store !== 'epic') {
    return {
      success: false,
      error: `Cancelling ${source.store} downloads is not supported`,
    }
  }

  const result = cancelEpicOperation(source.store_game_id)
  if (result.success) {
    updateInstallation(source.source_id, 'cancelled', 'Cancelled by user')
  }

  return result
}

function dismissDownloadTask(gameId) {
  const source = getPreferredSource(gameId)

  if (!source || !['failed', 'cancelled'].includes(source.install_state)) {
    return false
  }

  updateInstallation(source.source_id, 'not_installed')
  return true
}

module.exports = {
  installGame,
  uninstallGame,
  getGameInstallStatus,
  getDownloadTasks,
  cancelGameInstall,
  dismissDownloadTask,
}