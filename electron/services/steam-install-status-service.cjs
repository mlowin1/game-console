const fs = require('fs')
const path = require('path')

const {
  parseManifest,
  parseLibraryFolders,
} = require(
  '../integrations/steam/parser.cjs'
)

const {
  findSteamRoot,
} = require(
  './steam-service.cjs'
)

function getSteamLibraryPaths() {
  const steamRoot =
    findSteamRoot()

  if (!steamRoot) {
    return []
  }

  const libraryFoldersPath =
    path.join(
      steamRoot,
      'steamapps',
      'libraryfolders.vdf'
    )

  const extraLibraries =
    parseLibraryFolders(
      libraryFoldersPath
    )

  return [
    ...new Set([
      steamRoot,
      ...extraLibraries,
    ]),
  ]
}

function findSteamManifest(
  appId
) {
  const libraries =
    getSteamLibraryPaths()

  for (
    const libraryPath
    of libraries
  ) {
    const manifestPath =
      path.join(
        libraryPath,
        'steamapps',
        `appmanifest_${appId}.acf`
      )

    if (
      fs.existsSync(
        manifestPath
      )
    ) {
      return {
        libraryPath,
        manifestPath,
      }
    }
  }

  return null
}

function getSteamInstallStatus(
  appId
) {
  const location =
    findSteamManifest(
      appId
    )

  if (!location) {
    return {
      state:
        'not_installed',

      appId:
        String(appId),

      progress:
        0,

      downloadedBytes:
        0,

      totalBytes:
        0,

      sizeOnDisk:
        0,
    }
  }

  const manifest =
    parseManifest(
      location.manifestPath
    )

  const totalBytes =
    manifest.bytesToDownload

  const downloadedBytes =
    manifest.bytesDownloaded

  let progress = 0

  if (totalBytes > 0) {
    progress =
      Math.min(
        100,
        Math.max(
          0,
          (
            downloadedBytes /
            totalBytes
          ) * 100
        )
      )
  }

  /*
   * A Steam app manifest can exist before
   * installation is complete.
   *
   * StateFlags 4 is Steam's common
   * fully-installed state.
   */
  const fullyInstalled =
    manifest.stateFlags === 4

  /*
   * If Steam has download work recorded
   * and the app isn't fully installed,
   * expose it as downloading.
   */
  const downloading =
    !fullyInstalled &&
    totalBytes > 0

  let state

  if (fullyInstalled) {
    state = 'installed'
    progress = 100
  } else if (downloading) {
    state = 'downloading'
  } else {
    state = 'installing'
  }

    const stagingProgress =
    manifest.bytesToStage > 0
        ? Math.min(
            100,
            Math.max(
            0,
            (
                manifest.bytesStaged /
                manifest.bytesToStage
            ) * 100
            )
        )
        : 0

    return {
    state,

    appId:
        manifest.appId,

    name:
        manifest.name,

    stateFlags:
        manifest.stateFlags,

    progress,

    downloadedBytes,

    totalBytes,

    stagingProgress,

    stagedBytes:
        manifest.bytesStaged,

    totalStageBytes:
        manifest.bytesToStage,

    sizeOnDisk:
        manifest.sizeOnDisk,

    libraryPath:
        location.libraryPath,

    manifestPath:
        location.manifestPath,
    }
}

module.exports = {
  getSteamLibraryPaths,
  findSteamManifest,
  getSteamInstallStatus,
}