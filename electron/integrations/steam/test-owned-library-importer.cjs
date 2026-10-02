require('dotenv').config()

const {
  initializeDatabase,
} = require('../../database/db.cjs')

const {
  getOwnedSteamGames,
} = require('../../services/steam-owned-games-service.cjs')

const {
  importOwnedSteamGames,
} = require('./owned-library-importer.cjs')

async function main() {
  initializeDatabase()

  const games =
    await getOwnedSteamGames()

  const result =
    importOwnedSteamGames(games)

  console.log(
    'Owned library import:',
    result
  )
}

main().catch((error) => {
  console.error(
    'Owned library import failed:',
    error
  )

  process.exitCode = 1
})