const {
  initializeDatabase,
} = require('../database/db.cjs')

const {
  refreshSteamMetadata,
} = require('./game-metadata-service.cjs')

async function main() {
  initializeDatabase()

  const result =
    await refreshSteamMetadata()

  console.log(
    'Metadata refresh complete:',
    result
  )
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
