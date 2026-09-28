const path = require('path')

const {
  findManifests,
  parseManifest,
  parseLibraryFolders,
} = require('./parser.cjs')

function scanSteamLibrary(libraryPath) {
  const steamAppsPath = path.join(
    libraryPath,
    'steamapps'
  )

  const manifests = findManifests(steamAppsPath)

  return manifests.map((manifestPath) => {
    const game = parseManifest(manifestPath)

    return {
      ...game,

      libraryPath,

      installPath: path.join(
        steamAppsPath,
        'common',
        game.installDir
      ),

      launchMethod: 'steam',

      launchTarget:
        `steam://rungameid/${game.appId}`,
    }
  })
}

function scanSteamInstallation(steamRootPath) {
  const libraryFoldersPath = path.join(
    steamRootPath,
    'steamapps',
    'libraryfolders.vdf'
  )

  let libraryPaths =
    parseLibraryFolders(libraryFoldersPath)

  /*
   * Steam's own root is always worth checking.
   * Set removes duplicates if libraryfolders.vdf
   * already contains it.
   */
  libraryPaths = [
    ...new Set([
      steamRootPath,
      ...libraryPaths,
    ]),
  ]

  const games = []

  for (const libraryPath of libraryPaths) {
    const discovered =
      scanSteamLibrary(libraryPath)

    games.push(...discovered)
  }

  /*
   * Defensive deduplication by AppID.
   */
  const uniqueGames = new Map()

  for (const game of games) {
    uniqueGames.set(game.appId, game)
  }

  return {
    libraries: libraryPaths,
    games: [...uniqueGames.values()],
  }
}

module.exports = {
  scanSteamLibrary,
  scanSteamInstallation,
}
