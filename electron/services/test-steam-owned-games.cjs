require('dotenv').config()

const {
  getOwnedSteamGames,
} = require('./steam-owned-games-service.cjs')

async function main() {
  try {
    const games =
      await getOwnedSteamGames()

    console.log(
      `Owned Steam games: ${games.length}`
    )

    console.log(
      games.slice(0, 10)
    )
  } catch (error) {
    console.error(
      'Owned-games test failed:',
      error.message
    )

    process.exitCode = 1
  }
}

main()