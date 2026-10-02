require('dotenv').config()

const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('path')
const { initializeDatabase } = require('./database/db.cjs')
const { seedDatabase } = require('./database/seed.cjs')
const {
  getGames,
  getGameDetails,
  setCoverOverride,
  clearCoverOverride,
} = require('./database/games.cjs')
const { launchGame } = require('./launcher.cjs')
const {
  syncSteam,
} = require('./services/steam-service.cjs')
const {
  getEpicConnectionStatus,
  syncEpic,
} = require('./services/epic-service.cjs')
const {
  refreshSteamMetadata,
} = require('./services/game-metadata-service.cjs')
const {
  getGameRuntimeStatus,
} = require('./services/game-session-service.cjs')
const {
  startController,
} = require('./services/controller-service.cjs')
const CONSOLE_MODE =
  process.env.GAME_CONSOLE_MODE === '1'
const {
  getOwnedSteamGames,
} = require('./services/steam-owned-games-service.cjs')

const {
  importOwnedSteamGames,
} = require('./integrations/steam/owned-library-importer.cjs')

const {
  getSteamGridArtworkOptions,
  getSteamGridArtworkOptionsByName,
} = require('./services/steamgriddb-service.cjs')

const {
  installGame,
  uninstallGame,
  getGameInstallStatus,
} = require(
  './services/game-install-service.cjs'
)

let mainWindow = null

function createWindow() {
  mainWindow = new BrowserWindow({
    title: 'FinalForm',
    width: 1280,
    height: 720,

    backgroundColor: '#111111',

    fullscreen: false,
    frame: !CONSOLE_MODE,
  
    autoHideMenuBar: true,

    webPreferences: {
      preload: path.join(
        __dirname,
        'preload.cjs'
      ),

      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  /*
   * Remove Electron's application menu.
   *
   * We don't want File/Edit/View/etc.
   * appearing in the console UI.
   */
  mainWindow.setMenuBarVisibility(false)

  if (CONSOLE_MODE) {
    mainWindow.maximize()
  } 
 
  mainWindow.loadURL(
    'http://localhost:5173'
  )

  mainWindow.on('enter-full-screen', () => {
    console.log('ENTERED FULLSCREEN')
  })

  mainWindow.on('leave-full-screen', () => {
    console.log('LEFT FULLSCREEN')
  })

  mainWindow.on('maximize', () => {
    console.log('WINDOW MAXIMIZED')
  })

  mainWindow.on('unmaximize', () => {
    console.log('WINDOW UNMAXIMIZED')
  })

  /*
   * Development escape hatch.
   *
   * F11 toggles fullscreen even when we're
   * testing console mode.
   */
    mainWindow.webContents.on(
      'before-input-event',
      (_event, input) => {
        if (
          input.type === 'keyDown' &&
          input.key === 'F11'
        ) {
          console.log(
            'F11 pressed. Current fullscreen:',
            mainWindow.isFullScreen()
          )

          mainWindow.setFullScreen(
            !mainWindow.isFullScreen()
          )
        }
      }
    )

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

app.whenReady().then(async () => {
  initializeDatabase()
  seedDatabase()

  try {
    const ownedGames =
      await getOwnedSteamGames()

    const ownedResult =
      importOwnedSteamGames(ownedGames)

    console.log(
      `Steam owned library sync: ${ownedResult.total} total, ${ownedResult.added} added, ${ownedResult.updated} updated`
    )
  } catch (error) {
    console.error(
      'Steam owned library sync failed:',
      error
    )
  }

  try {
    const steamResult = syncSteam()

    if (steamResult.found) {
      console.log(
        `Startup Steam sync: ${steamResult.games.length} game(s)`
      )
    }
  } catch (error) {
    console.error('Steam startup sync failed:', error)
  }

  try {
    const metadataResult =
      await refreshSteamMetadata()

    console.log(
      `Startup metadata refresh: ${metadataResult.updated} updated, ${metadataResult.failed} failed`
    )
  } catch (error) {
    console.error(
      'Startup metadata refresh failed:',
      error
    )
  }

    startController({
      onCommand: (command) => {
        if (
          mainWindow &&
          !mainWindow.isDestroyed()
        ) {
          mainWindow.webContents.send(
            'controller:command',
            command
          )
        }
      },

      onConnected: (devicePath) => {
        console.log(
          `Controller ready: ${devicePath}`
        )
      },

      onDisconnected: () => {
        console.log(
          'Controller disconnected'
        )
      },
    })

    ipcMain.handle('games:getAll', () => {
      return getGames()
    })

    ipcMain.handle('games:getDetails', (_event, gameId) => {
      if (!Number.isInteger(gameId)) {
        throw new Error('Invalid game ID')
      }

      return getGameDetails(gameId)
    })

    ipcMain.handle(
      'games:getArtworkOptions',
      async (_event, gameId) => {
        if (!Number.isInteger(gameId)) {
          throw new Error('Invalid game ID')
        }

        const game =
          getGameDetails(gameId)

        if (!game) {
          throw new Error('Game not found')
        }

        const steamSource = game.sources.find(
          (source) => source.store === 'steam'
        )

        if (steamSource) {
          return getSteamGridArtworkOptions(
            steamSource.store_game_id,
            12
          )
        }

        return getSteamGridArtworkOptionsByName(
          game.title,
          12
        )
      }
    )

    ipcMain.handle(
      'games:setCoverOverride',
      (_event, gameId, coverUrl) => {
        if (!Number.isInteger(gameId)) {
          throw new Error('Invalid game ID')
        }

        if (
          typeof coverUrl !== 'string' ||
          !coverUrl.startsWith('https://')
        ) {
          throw new Error(
            'Invalid cover URL'
          )
        }

        return setCoverOverride(
          gameId,
          coverUrl
        )
      }
    )

    ipcMain.handle(
      'games:clearCoverOverride',
      (_event, gameId) => {
        if (!Number.isInteger(gameId)) {
          throw new Error('Invalid game ID')
        }

        return clearCoverOverride(gameId)
      }
    )

    ipcMain.handle('games:launch', (_event, gameId) => {
      if (!Number.isInteger(gameId)) {
        throw new Error('Invalid game ID')
      }

      return launchGame(gameId, {
        onStarted: () => {
          console.log('Game started — hiding launcher')

          if (
            mainWindow &&
            !mainWindow.isDestroyed()
          ) {
            mainWindow.hide()
          }
        },

        onExited: () => {
          console.log('Game exited — restoring launcher')
          restoreLauncherWindow()
        },

        onFailed: () => {
          console.log('Game launch failed — restoring launcher')
          restoreLauncherWindow()
        },
      })
    })

    ipcMain.handle(
      'games:install',
      (_event, gameId) => {
        if (!Number.isInteger(gameId)) {
          throw new Error(
            'Invalid game ID'
          )
        }

        return installGame(gameId)
      }
    )

    ipcMain.handle(
      'games:uninstall',
      (_event, gameId) => {
        if (!Number.isInteger(gameId)) {
          throw new Error(
            'Invalid game ID'
          )
        }

        return uninstallGame(gameId)
      }
    )

    ipcMain.handle(
      'games:install-status',
      async (_event, gameId) => {
        if (!Number.isInteger(gameId)) {
          throw new Error(
            'Invalid game ID'
          )
        }

        return await getGameInstallStatus(
          gameId
        )
      }
    )

    ipcMain.handle('steam:sync', async () => {
      try {
        const steamResult = syncSteam()
        const epicResult = await syncEpic()

        return {
          success: true,
          ...steamResult,
          epic: epicResult,
        }
      } catch (error) {
        console.error('Manual Steam sync failed:', error)

        return {
          success: false,
          found: false,
          games: [],
          error: error.message,
        }
      }
    })

    ipcMain.handle('epic:sync', async () => {
      try {
        const epicResult = await syncEpic()
        let metadataResult = null

        try {
          metadataResult = await refreshSteamMetadata({
            force: true,
            store: 'epic',
          })
        } catch (error) {
          console.warn('Epic metadata refresh failed:', error.message)
        }

        return {
          success: true,
          ...epicResult,
          metadata: metadataResult,
        }
      } catch (error) {
        console.error('Manual Epic sync failed:', error)

        return {
          success: false,
          found: false,
          games: [],
          error: error.message,
        }
      }
    })

    ipcMain.handle('epic:status', async () => {
      return await getEpicConnectionStatus()
    })

    ipcMain.handle('launcher:show', () => {
      restoreLauncherWindow()
      return { success: true }
    })

    ipcMain.handle('launcher:hide', () => {
      if (
        mainWindow &&
        !mainWindow.isDestroyed()
      ) {
        mainWindow.hide()
      }

      return { success: true }
    })

    ipcMain.handle(
      'games:runtime-status',
      async (_event, gameId) => {
        return getGameRuntimeStatus(gameId)
      }
    )

  createWindow()

function restoreLauncherWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return
  }

  mainWindow.show()

  if (mainWindow.isMinimized()) {
    mainWindow.restore()
  }

  mainWindow.focus()
}

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
