const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('launcher', {
  platform: process.platform,
  version: '0.1.0',

  getGames: () => ipcRenderer.invoke('games:getAll'),

  getGameDetails: (gameId) =>
    ipcRenderer.invoke('games:getDetails', gameId),

  launchGame: (gameId) =>
    ipcRenderer.invoke('games:launch', gameId),

  syncSteam: () =>
    ipcRenderer.invoke('steam:sync'),
})
