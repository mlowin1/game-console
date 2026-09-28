const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('path')
const { initializeDatabase } = require('./database/db.cjs')
const { seedDatabase } = require('./database/seed.cjs')
const {
  getGames,
  getGameDetails,
} = require('./database/games.cjs')
const { launchGame } = require('./launcher.cjs')
const {
  syncSteam,
} = require('./services/steam-service.cjs')
const {
  getGameRuntimeStatus,
} = require('./services/game-session-service.cjs')

let mainWindow = null

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 720,
    backgroundColor: '#111111',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  mainWindow.loadURL('http://localhost:5173')

  mainWindow.on('closed', () => {
    mainWindow = null
})
}

app.whenReady().then(() => {
  initializeDatabase()
  seedDatabase()

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

    ipcMain.handle('games:getAll', () => {
      return getGames()
    })

    ipcMain.handle('games:getDetails', (_event, gameId) => {
      if (!Number.isInteger(gameId)) {
        throw new Error('Invalid game ID')
      }

      return getGameDetails(gameId)
    })

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

    ipcMain.handle('steam:sync', async () => {
      try {
        const result = syncSteam()

        return {
          success: true,
          ...result,
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
