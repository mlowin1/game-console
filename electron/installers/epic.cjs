const {
  startOperation,
} = require('../integrations/epic/legendary.cjs')

function installEpicGame(appId) {
  if (!appId) {
    return {
      success: false,
      error: 'Missing Epic App ID',
    }
  }

  console.log(
    `Requesting Epic install through Legendary: ${appId}`
  )

  return startOperation(appId, 'install')
}

function uninstallEpicGame(appId) {
  if (!appId) {
    return {
      success: false,
      error: 'Missing Epic App ID',
    }
  }

  console.log(
    `Requesting Epic uninstall through Legendary: ${appId}`
  )

  return startOperation(appId, 'uninstall')
}

module.exports = {
  installEpicGame,
  uninstallEpicGame,
}
