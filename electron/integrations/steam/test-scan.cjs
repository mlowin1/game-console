const path = require('path')
const { scanSteamLibrary } =
  require('./detector.cjs')

const libraryPath = path.resolve(
  __dirname,
  '../../../dev-steam'
)

const games = scanSteamLibrary(libraryPath)

console.log('\nSteam games discovered:\n')

for (const game of games) {
  console.log(`Title: ${game.name}`)
  console.log(`AppID: ${game.appId}`)
  console.log(`Installed: ${game.installPath}`)
  console.log(`Launch: ${game.launchTarget}`)
  console.log('---')
}
