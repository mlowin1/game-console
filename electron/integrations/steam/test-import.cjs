const os = require('os')
const path = require('path')

const {
  initializeDatabase,
} = require('../../database/db.cjs')

const {
  importSteamLibrary,
} = require('./importer.cjs')

initializeDatabase()

const steamRoot = path.join(
  os.homedir(),
  '.local',
  'share',
  'Steam'
)

console.log(`Steam root: ${steamRoot}`)

const results = importSteamLibrary(steamRoot)

console.log('\nSteam import complete:\n')

for (const result of results) {
  console.log(
    `${result.title} | AppID ${result.appId} | Game ID ${result.gameId}`
  )
}
