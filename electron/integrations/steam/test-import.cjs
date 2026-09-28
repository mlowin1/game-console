const path = require('path')
const { initializeDatabase } =
  require('../../database/db.cjs')

const { importSteamLibrary } =
  require('./importer.cjs')

initializeDatabase()

const libraryPath = path.resolve(
  __dirname,
  '../../../dev-steam'
)

const results =
  importSteamLibrary(libraryPath)

console.log('\nSteam import complete:\n')

for (const result of results) {
  console.log(
    `${result.title} | AppID ${result.appId} | Game ID ${result.gameId}`
  )
}
