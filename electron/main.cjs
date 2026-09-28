const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('path')
const { initializeDatabase } = require('./database/db.cjs')
const { seedDatabase } = require('./database/seed.cjs')
const { getGames } = require('./database/games.cjs')

function createWindow() {
  const window = new BrowserWindow({
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

  window.loadURL('http://localhost:5173')
}

app.whenReady().then(() => {
  initializeDatabase()
  seedDatabase()

    ipcMain.handle('games:getAll', () => {
      return getGames()
    })

  createWindow()

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
