const fs = require('fs')
const path = require('path')
const os = require('os')

function normalizeAppId(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function readJsonFile(filePath) {
  try {
    const text = fs.readFileSync(filePath, 'utf8')

    if (!text.trim()) {
      return null
    }

    return JSON.parse(text)
  } catch (error) {
    return null
  }
}

function collectEntryCandidates(value) {
  if (!value || typeof value !== 'object') {
    return []
  }

  const items = []

  if (Array.isArray(value.InstallationList)) {
    items.push(...value.InstallationList)
  }

  if (Array.isArray(value.installations)) {
    items.push(...value.installations)
  }

  if (Array.isArray(value.installationList)) {
    items.push(...value.installationList)
  }

  if (
    value.AppName ||
    value.appName ||
    value.Name ||
    value.name ||
    value.InstallLocation ||
    value.installLocation
  ) {
    items.push(value)
  }

  return items
}

function extractEpicEntry(entry) {
  const appId =
    entry.AppName ||
    entry.appName ||
    entry.Name ||
    entry.name ||
    entry.appName ||
    entry.Namespace ||
    'epic-game'

  const title =
    entry.InstallationName ||
    entry.DisplayName ||
    entry.AppName ||
    entry.appName ||
    entry.Name ||
    entry.name ||
    'Epic Game'

  const installPath =
    entry.InstallLocation ||
    entry.installLocation ||
    entry.InstallPath ||
    entry.installPath ||
    null

  const launchTarget =
    entry.LaunchExecutable ||
    entry.launchExecutable ||
    entry.Executable ||
    entry.executable ||
    null

  return {
    appId: normalizeAppId(appId) || 'epic-game',
    title: String(title).trim() || 'Epic Game',
    installPath,
    launchTarget,
  }
}

function getEpicConfigRoots() {
  const home = os.homedir()

  const envOverrides = [
    process.env.EPIC_LAUNCHER_PATH,
    process.env.EPIC_PATH,
    process.env.EPIC_CONFIG_DIR,
    process.env.EPIC_INSTALL_DIR,
    process.env.EPIC_DATA_DIR,
  ].filter(Boolean)

  const candidates = [
    ...envOverrides,
    path.join(home, '.config', 'Epic'),
    path.join(home, '.config', 'EpicGamesLauncher'),
    path.join(home, '.config', 'EpicGamesLauncher', 'Launcher'),
    path.join(home, '.config', 'Epic', 'Launcher'),
    path.join(home, '.config', 'Epic', 'UnrealEngineLauncher'),
    path.join(home, '.config', 'EpicGamesLauncher', 'UnrealEngineLauncher'),
    path.join(home, '.var', 'app', 'com.epicgames.launcher', '.config', 'Epic'),
    path.join(home, '.var', 'app', 'com.epicgames.launcher', '.config', 'EpicGamesLauncher'),
  ]

  return [...new Set(candidates)]
}

function findEpicLauncherFiles() {
  const files = []

  for (const candidate of getEpicConfigRoots()) {
    if (!fs.existsSync(candidate)) {
      continue
    }

    const launcherInstalled = path.join(
      candidate,
      'LauncherInstalled.dat'
    )

    if (fs.existsSync(launcherInstalled)) {
      files.push(launcherInstalled)
    }

    try {
      const entries = fs.readdirSync(candidate)

      for (const entry of entries) {
        const filePath = path.join(candidate, entry)

        if (
          filePath.endsWith('LauncherInstalled.dat') &&
          fs.existsSync(filePath)
        ) {
          files.push(filePath)
        }

        if (
          fs.statSync(filePath).isDirectory() &&
          fs.existsSync(
            path.join(filePath, 'LauncherInstalled.dat')
          )
        ) {
          files.push(
            path.join(filePath, 'LauncherInstalled.dat')
          )
        }
      }
    } catch (error) {
      // Ignore unreadable directories.
    }
  }

  return [...new Set(files)]
}

function scanEpicInstallation() {
  const discovered = new Map()

  for (const launcherFile of findEpicLauncherFiles()) {
    const parsed = readJsonFile(launcherFile)

    if (!parsed) {
      continue
    }

    const entries = collectEntryCandidates(parsed)

    for (const entry of entries) {
      const normalized = extractEpicEntry(entry)

      if (!normalized.appId || normalized.appId === 'epic-game') {
        continue
      }

      discovered.set(normalized.appId, {
        appId: normalized.appId,
        title: normalized.title,
        installPath: normalized.installPath,
        launchTarget: normalized.launchTarget,
        store: 'epic',
      })
    }
  }

  return [...discovered.values()].sort((a, b) =>
    a.title.localeCompare(b.title)
  )
}

function getEpicConnectionStatus() {
  const launcherFiles = findEpicLauncherFiles()
  const discovered = scanEpicInstallation()

  return {
    connected:
      launcherFiles.length > 0 ||
      discovered.length > 0,
    launcherFiles,
    rootPaths: getEpicConfigRoots(),
    foundGames: discovered.length,
    games: discovered,
  }
}

module.exports = {
  scanEpicInstallation,
  findEpicLauncherFiles,
  getEpicConfigRoots,
  getEpicConnectionStatus,
  normalizeAppId,
}
