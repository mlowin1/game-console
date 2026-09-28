const fs = require('fs')
const path = require('path')
const os = require('os')

const {
  importSteamLibrary,
} = require('../integrations/steam/importer.cjs')

function findSteamRoot() {
  const home = os.homedir()

  const candidates = [
    path.join(home, '.steam', 'steam'),
    path.join(home, '.local', 'share', 'Steam'),
    path.join(home, '.var', 'app', 'com.valvesoftware.Steam', '.local', 'share', 'Steam'),

    // Development Steam installation
    path.join(process.cwd(), 'dev-steam'),
  ]

  for (const candidate of candidates) {
    if (
      fs.existsSync(
        path.join(candidate, 'steamapps')
      )
    ) {
      return candidate
    }
  }

  return null
}

function syncSteam() {
  const steamRoot = findSteamRoot()

  if (!steamRoot) {
    console.log('Steam installation not found.')

    return {
      found: false,
      steamRoot: null,
      games: [],
    }
  }

  console.log(`Steam root: ${steamRoot}`)

  const games = importSteamLibrary(steamRoot)

  console.log(
    `Steam sync complete: ${games.length} game(s)`
  )

  return {
    found: true,
    steamRoot,
    games,
  }
}

module.exports = {
  findSteamRoot,
  syncSteam,
}
