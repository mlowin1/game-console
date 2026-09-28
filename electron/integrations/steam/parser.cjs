const fs = require('fs')
const path = require('path')
const VDF = require('@node-steam/vdf')

function parseManifest(manifestPath) {
  const contents = fs.readFileSync(manifestPath, 'utf8')
  const parsed = VDF.parse(contents)

  const app = parsed.AppState

  if (!app) {
    throw new Error(
      `Invalid Steam manifest: ${manifestPath}`
    )
  }

  return {
    appId: String(app.appid),
    name: app.name,
    installDir: app.installdir,
    stateFlags: Number(app.StateFlags ?? 0),
    sizeOnDisk: Number(app.SizeOnDisk ?? 0),
  }
}

function findManifests(steamAppsPath) {
  if (!fs.existsSync(steamAppsPath)) {
    return []
  }

  return fs
    .readdirSync(steamAppsPath)
    .filter((file) =>
      /^appmanifest_\d+\.acf$/.test(file)
    )
    .map((file) =>
      path.join(steamAppsPath, file)
    )
}

function parseLibraryFolders(libraryFoldersPath) {
  if (!fs.existsSync(libraryFoldersPath)) {
    return []
  }

  const contents = fs.readFileSync(
    libraryFoldersPath,
    'utf8'
  )

  const parsed = VDF.parse(contents)
  const folders = parsed.libraryfolders

  if (!folders) {
    return []
  }

  return Object.values(folders)
    .filter(
      (folder) =>
        folder &&
        typeof folder === 'object' &&
        folder.path
    )
    .map((folder) => folder.path)
}

module.exports = {
  parseManifest,
  findManifests,
  parseLibraryFolders,
}
