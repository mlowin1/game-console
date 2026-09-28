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

  getGameRuntimeStatus: (gameId) =>
    ipcRenderer.invoke(
      'games:runtime-status',
      gameId
    ),

    onControllerCommand: (callback) => {
      const listener = (_event, command) => {
        callback(command)
      }

      ipcRenderer.on(
        'controller:command',
        listener
      )

      return () => {
        ipcRenderer.removeListener(
          'controller:command',
          listener
        )
      }
    },
})
