const { launchGame } = require('../integrations/epic/legendary.cjs')

function launchEpic(appId, lifecycle, installPath) {
  return launchGame(appId, lifecycle, installPath)
}

module.exports = {
  launchEpic,
}
