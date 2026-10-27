const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('launcher', {
  platform: process.platform,
  version: '0.1.0',

  getGames: () => ipcRenderer.invoke('games:getAll'),

  getGameDetails: (gameId) =>
    ipcRenderer.invoke('games:getDetails', gameId),

  getGameInstallStatus: (gameId) =>
    ipcRenderer.invoke(
      'games:install-status',
      gameId
    ),

  getDownloadTasks: () =>
    ipcRenderer.invoke('games:download-tasks'),

  cancelGameInstall: (gameId) =>
    ipcRenderer.invoke('games:cancel-install', gameId),

  dismissDownloadTask: (gameId) =>
    ipcRenderer.invoke('games:dismiss-download', gameId),

  getArtworkOptions: (gameId) =>
    ipcRenderer.invoke(
      'games:getArtworkOptions',
      gameId
    ),

  setCoverOverride: (
    gameId,
    coverUrl
  ) =>
    ipcRenderer.invoke(
      'games:setCoverOverride',
      gameId,
      coverUrl
    ),

  clearCoverOverride: (gameId) =>
    ipcRenderer.invoke(
      'games:clearCoverOverride',
      gameId
    ),

  installGame: (gameId) =>
    ipcRenderer.invoke(
      'games:install',
      gameId
    ),

  uninstallGame: (gameId) =>
    ipcRenderer.invoke(
      'games:uninstall',
      gameId
    ),

  launchGame: (gameId) =>
    ipcRenderer.invoke('games:launch', gameId),

  hideWindow: () =>
    ipcRenderer.invoke('launcher:hide'),

  showWindow: () =>
    ipcRenderer.invoke('launcher:show'),

  syncSteam: () =>
    ipcRenderer.invoke('steam:sync'),

  syncEpic: () =>
    ipcRenderer.invoke('epic:sync'),

  getEpicConnectionStatus: () =>
    ipcRenderer.invoke('epic:status'),

  getProviderSyncStatus: () =>
    ipcRenderer.invoke('providers:status'),

  onLibraryChanged: (callback) => {
    const listener = () => callback()

    ipcRenderer.on('library:changed', listener)

    return () => {
      ipcRenderer.removeListener('library:changed', listener)
    }
  },

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
