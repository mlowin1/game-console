const os = require('os')
const path = require('path')

const {
  scanSteamInstallation,
} = require('./detector.cjs')

const steamRoot = path.join(
  os.homedir(),
  '.local',
  'share',
  'Steam'
)

console.log(`Steam root: ${steamRoot}`)

const result = scanSteamInstallation(steamRoot)

console.log('\nSteam libraries:')

for (const library of result.libraries) {
  console.log(`- ${library}`)
}

console.log('\nSteam games discovered:\n')

for (const game of result.games) {
  console.log(`Title: ${game.name}`)
  console.log(`AppID: ${game.appId}`)
  console.log(`Installed: ${game.installPath}`)
  console.log(`Launch: ${game.launchTarget}`)
  console.log('---')
}
