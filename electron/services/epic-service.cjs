const { getDatabase } = require('../database/db.cjs')
const legendary = require('../integrations/epic/legendary.cjs')

function sameAppId(left, right) {
  return String(left).toLowerCase() === String(right).toLowerCase()
}

async function getEpicInstallStatus(appId) {
  const operation = legendary.getOperation(appId)

  if (operation && !operation.finished) {
    return {
      state:
        operation.action === 'uninstall'
          ? 'uninstalling'
          : 'installing',
      appId: String(appId),
      progress: operation.progress,
      downloadedBytes: 0,
      totalBytes: 0,
      stagedBytes: 0,
      totalStageBytes: 0,
    }
  }

  if (operation?.finished && operation.error) {
    return {
      state: 'unknown',
      appId: String(appId),
      progress: operation.progress,
      downloadedBytes: 0,
      totalBytes: 0,
      error: operation.error,
    }
  }

  try {
    const installed = await legendary.listInstalledGames(true)
    const match = installed.find((game) => sameAppId(game.appId, appId))

    if (match) {
      return {
        state: 'installed',
        appId: match.appId,
        progress: 100,
        downloadedBytes: 0,
        totalBytes: 0,
        stagedBytes: 0,
        totalStageBytes: 0,
        installPath: match.installPath,
        launchTarget: match.appId,
      }
    }

    return {
      state: 'not_installed',
      appId: String(appId),
      progress: 0,
      downloadedBytes: 0,
      totalBytes: 0,
      stagedBytes: 0,
      totalStageBytes: 0,
    }
  } catch (error) {
    return {
      state: 'unknown',
      appId: String(appId),
      progress: 0,
      downloadedBytes: 0,
      totalBytes: 0,
      error: error.message,
    }
  }
}

async function syncEpic() {
  const ownedGames = await legendary.listOwnedGames()
  const installedGames = await legendary.listInstalledGames(true)
  const installedById = new Map(
    installedGames.map((game) => [game.appId.toLowerCase(), game])
  )
  const db = getDatabase()
  let added = 0
  let updated = 0

  const importLibrary = db.transaction(() => {
    for (const game of ownedGames) {
      let source = db.prepare(`
        SELECT id, game_id
        FROM game_sources
        WHERE store = 'epic'
          AND LOWER(store_game_id) = LOWER(?)
        LIMIT 1
      `).get(game.appId)

      if (source) {
        db.prepare(`
          UPDATE game_sources
          SET owned = 1, store_game_id = ?
          WHERE id = ?
        `).run(game.appId, source.id)
        updated += 1
      } else {
        const existingGame = db.prepare(`
          SELECT id
          FROM games
          WHERE LOWER(TRIM(title)) = LOWER(TRIM(?))
          LIMIT 1
        `).get(game.title)

        const gameId = existingGame
          ? existingGame.id
          : Number(db.prepare(`
              INSERT INTO games (title, description)
              VALUES (?, ?)
            `).run(
              game.title,
              'Available on the Epic Games Store.'
            ).lastInsertRowid)

        const result = db.prepare(`
          INSERT INTO game_sources (
            game_id,
            store,
            store_game_id,
            owned
          )
          VALUES (?, 'epic', ?, 1)
        `).run(gameId, game.appId)

        source = { id: Number(result.lastInsertRowid) }
        added += 1
      }

      const installed = installedById.get(game.appId.toLowerCase())
      const existingInstallation = db.prepare(`
        SELECT id
        FROM installations
        WHERE game_source_id = ?
        LIMIT 1
      `).get(source.id)

      if (existingInstallation) {
        db.prepare(`
          UPDATE installations
          SET
            install_state = ?,
            install_path = ?,
            launch_method = 'epic',
            launch_target = ?
          WHERE id = ?
        `).run(
          installed ? 'installed' : 'not_installed',
          installed?.installPath ?? null,
          game.appId,
          existingInstallation.id
        )
      } else {
        db.prepare(`
          INSERT INTO installations (
            game_source_id,
            install_state,
            install_path,
            launch_method,
            launch_target
          )
          VALUES (?, ?, ?, 'epic', ?)
        `).run(
          source.id,
          installed ? 'installed' : 'not_installed',
          installed?.installPath ?? null,
          game.appId
        )
      }
    }
  })

  importLibrary()

  return {
    found: ownedGames.length,
    added,
    updated,
    installed: installedGames.length,
    games: ownedGames,
  }
}

async function getEpicConnectionStatus() {
  return legendary.getConnectionStatus()
}

module.exports = {
  getEpicConnectionStatus,
  getEpicInstallStatus,
  syncEpic,
}