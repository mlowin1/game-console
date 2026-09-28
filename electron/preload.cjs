const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('launcher', {
  platform: process.platform,
  version: '0.1.0',

  getGames: () => ipcRenderer.invoke('games:getAll'),
})
