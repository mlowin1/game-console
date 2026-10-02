const { spawn, spawnSync } = require('child_process')
const fs = require('fs')
const os = require('os')
const path = require('path')

const operations = new Map()
let commandVerified = false
let connectionStatusCache = null
let connectionStatusExpiresAt = 0
let connectionStatusPromise = null
let installedCache = {
  expiresAt: 0,
  games: [],
}

function getCommand() {
  const configuredCommand =
    process.env.EPIC_LEGENDARY_CLI ||
    process.env.LEGENDARY_CLI_PATH ||
    null

  if (configuredCommand) {
    return configuredCommand
  }

  const pipxCommand = path.join(
    os.homedir(),
    '.local',
    'bin',
    'legendary'
  )

  return fs.existsSync(pipxCommand)
    ? pipxCommand
    : 'legendary'
}

function getWine64Command() {
  if (process.env.EPIC_WINE_BINARY) {
    return process.env.EPIC_WINE_BINARY
  }

  for (const directory of (process.env.PATH || '').split(path.delimiter)) {
    if (!directory) continue

    const candidate = path.join(directory, 'wine64')

    try {
      fs.accessSync(candidate, fs.constants.X_OK)
      return candidate
    } catch {}
  }

  return null
}

function sanitizeOutput(output) {
  return String(output || '')
    .replace(/(-AUTH_PASSWORD=)\S+/gi, '$1[redacted]')
    .replace(/((?:access_token|refresh_token|authorizationCode|exchangeToken)["']?\s*[:=]\s*["']?)[^\s"']+/gi, '$1[redacted]')
}

function setupError() {
  return new Error(
    'Legendary CLI is required. Install it with `pipx install legendary-gl`, then run `legendary auth` to connect your Epic account.'
  )
}

function checkCommand() {
  if (commandVerified) {
    return
  }

  const result = spawnSync(
    getCommand(),
    ['--version'],
    { encoding: 'utf8', timeout: 10000 }
  )

  if (result.error || result.status !== 0) {
    throw setupError()
  }

  commandVerified = true
}

function parseJsonOutput(output) {
  const text = String(output || '').trim()

  try {
    return JSON.parse(text)
  } catch {}

  for (let start = 0; start < text.length; start += 1) {
    if (text[start] !== '[' && text[start] !== '{') {
      continue
    }

    const opening = text[start]
    const closing = opening === '[' ? ']' : '}'
    let depth = 0
    let inString = false
    let escaped = false

    for (let end = start; end < text.length; end += 1) {
      const character = text[end]

      if (inString) {
        if (escaped) {
          escaped = false
        } else if (character === '\\') {
          escaped = true
        } else if (character === '"') {
          inString = false
        }
        continue
      }

      if (character === '"') {
        inString = true
      } else if (character === opening) {
        depth += 1
      } else if (character === closing) {
        depth -= 1

        if (depth === 0) {
          try {
            return JSON.parse(text.slice(start, end + 1))
          } catch {
            break
          }
        }
      }
    }
  }

  throw new Error('Legendary returned invalid JSON output')
}

function toRows(value) {
  if (Array.isArray(value)) {
    return value
  }

  if (!value || typeof value !== 'object') {
    return []
  }

  for (const key of ['games', 'apps', 'results', 'items']) {
    if (Array.isArray(value[key])) {
      return value[key]
    }
  }

  return Object.values(value).filter(
    (entry) => entry && typeof entry === 'object'
  )
}

function normalizeGame(entry) {
  if (!entry || typeof entry !== 'object') {
    return null
  }

  const appId =
    entry.app_name ||
    entry.appName ||
    entry.AppName ||
    entry.namespace ||
    entry.id

  if (!appId) {
    return null
  }

  return {
    appId: String(appId),
    title: String(
      entry.app_title ||
      entry.title ||
      entry.display_name ||
      entry.name ||
      appId
    ),
    installPath:
      entry.install_path ||
      entry.installPath ||
      null,
    launchTarget: String(appId),
  }
}

function runJsonCommand(args) {
  checkCommand()

  return new Promise((resolve, reject) => {
    const child = spawn(getCommand(), args, {
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let stdout = ''
    let stderr = ''

    const timeout = setTimeout(() => {
      child.kill('SIGTERM')
      reject(new Error(`Legendary command timed out: ${args.join(' ')}`))
    }, 60000)

    child.stdout.setEncoding('utf8')
    child.stderr.setEncoding('utf8')
    child.stdout.on('data', (chunk) => {
      stdout += chunk
    })
    child.stderr.on('data', (chunk) => {
      stderr += chunk
    })
    child.on('error', (error) => {
      clearTimeout(timeout)
      reject(error)
    })
    child.on('close', (code) => {
      clearTimeout(timeout)

      if (code !== 0) {
        const detail = String(stderr || stdout).trim()
        reject(new Error(detail || `Legendary command failed: ${args.join(' ')}`))
        return
      }

      try {
        resolve(parseJsonOutput(stdout))
      } catch (error) {
        reject(error)
      }
    })
  })
}

async function listOwnedGames() {
  return toRows(
    await runJsonCommand(['list', '--json'])
  ).map(normalizeGame).filter(Boolean)
}

async function listInstalledGames(forceRefresh = false) {
  if (
    !forceRefresh &&
    installedCache.expiresAt > Date.now()
  ) {
    return installedCache.games
  }

  const games = toRows(
    await runJsonCommand(['list-installed', '--json'])
  ).map(normalizeGame).filter(Boolean)

  installedCache = {
    expiresAt: Date.now() + 2000,
    games,
  }

  return games
}

function operationKey(appId) {
  return String(appId).toLowerCase()
}

function findRunningEpicGameProcesses(appId, installPath, excludedPid) {
  if (process.platform !== 'linux' || !fs.existsSync('/proc')) {
    return []
  }

  let processIds

  try {
    processIds = fs.readdirSync('/proc')
      .filter((entry) => /^\d+$/.test(entry))
  } catch {
    return []
  }

  const epicAppMarker = `-epicapp=${String(appId).toLowerCase()}`
  const normalizedInstallPath = installPath
    ? path.resolve(installPath).toLowerCase()
    : null

  return processIds.filter((processId) => {
    if (
      Number(processId) === process.pid ||
      Number(processId) === excludedPid
    ) {
      return false
    }

    try {
      const commandLine = fs.readFileSync(
        path.join('/proc', processId, 'cmdline'),
        'utf8'
      ).replace(/\0/g, ' ').toLowerCase()

      return commandLine.includes(epicAppMarker) ||
        Boolean(
          normalizedInstallPath &&
          commandLine.includes(normalizedInstallPath)
        )
    } catch {
      return false
    }
  })
}

function startOperation(appId, action) {
  if (!appId) {
    return { success: false, error: 'Missing Epic App ID' }
  }

  try {
    checkCommand()
  } catch (error) {
    return { success: false, error: error.message }
  }

  const key = operationKey(appId)
  const existing = operations.get(key)

  if (existing?.child.exitCode === null) {
    return {
      success: false,
      error: `Legendary is already ${existing.action}ing this game`,
    }
  }

  const args =
    action === 'install'
      ? ['--yes', 'install', String(appId)]
      : ['--yes', 'uninstall', String(appId)]

  let child

  try {
    child = spawn(getCommand(), args, {
      stdio: ['ignore', 'pipe', 'pipe'],
    })
  } catch (error) {
    return { success: false, error: error.message }
  }

  const operation = {
    action,
    appId: String(appId),
    child,
    progress: 0,
    output: '',
  }

  operations.set(key, operation)

  const collectOutput = (chunk) => {
    operation.output = sanitizeOutput(
      `${operation.output}${chunk.toString()}`
    ).slice(-16000)

    const matches = operation.output.match(/(?:^|\s)(\d{1,3}(?:\.\d+)?)%/g)
    const latest = matches?.at(-1)?.match(/(\d{1,3}(?:\.\d+)?)%/)

    if (latest) {
      operation.progress = Math.min(99, Number(latest[1]))
    }
  }

  child.stdout.on('data', collectOutput)
  child.stderr.on('data', collectOutput)

  child.on('error', (error) => {
    operation.error = error.message
    operation.finished = true
    installedCache.expiresAt = 0
  })

  child.on('close', (code) => {
    operation.finished = true
    operation.exitCode = code
    operation.error = code === 0
      ? null
      : operation.output.trim() || `Legendary exited with code ${code}`
    operation.progress = code === 0 ? 100 : operation.progress
    installedCache.expiresAt = 0
  })

  return {
    success: true,
    appId: String(appId),
    action,
    pid: child.pid,
  }
}

function getOperation(appId) {
  return operations.get(operationKey(appId)) || null
}

async function getConnectionStatus() {
  if (
    connectionStatusCache &&
    connectionStatusExpiresAt > Date.now()
  ) {
    return connectionStatusCache
  }

  if (connectionStatusPromise) {
    return connectionStatusPromise
  }

  connectionStatusPromise = (async () => {
  try {
    const games = await listOwnedGames()

    connectionStatusCache = {
      available: true,
      connected: true,
      foundGames: games.length,
      error: null,
    }
    connectionStatusExpiresAt = Date.now() + 30000
  } catch (error) {
    const unavailable = error.message.startsWith('Legendary CLI is required')

    connectionStatusCache = {
      available: !unavailable,
      connected: false,
      foundGames: 0,
      error: error.message,
    }
    connectionStatusExpiresAt = Date.now() + 5000
  }
    return connectionStatusCache
  })()

  try {
    return await connectionStatusPromise
  } finally {
    connectionStatusPromise = null
  }
}

function launchGame(appId, lifecycle = {}, installPath = null) {
  if (!appId) {
    return Promise.resolve({
      success: false,
      error: 'Missing Epic App ID',
    })
  }

  try {
    checkCommand()
  } catch (error) {
    return Promise.resolve({
      success: false,
      error: error.message,
    })
  }

  return new Promise((resolve) => {
    const launchArgs = [
      '--yes',
      'launch',
      String(appId),
    ]
    const wine64Command = getWine64Command()

    if (wine64Command) {
      launchArgs.push('--wine', wine64Command)
    }

    const child = spawn(
      getCommand(),
      launchArgs,
      { detached: true, stdio: ['ignore', 'pipe', 'pipe'] }
    )
    let output = ''
    let started = false
    let settled = false
    let cliExitCode = null
    let lastDetectedAt = 0
    let startedAt = 0
    let lastDetectedPid = null
    let startupTimeout
    let processMonitor

    const finish = (value, failed = false) => {
      if (settled) return
      settled = true
      clearTimeout(startupTimeout)
      clearInterval(processMonitor)
      if (failed) lifecycle.onFailed?.()
      resolve(value)
    }

    const collectOutput = (chunk) => {
      output = sanitizeOutput(
        `${output}${chunk.toString()}`
      ).slice(-16000)
    }

    const checkGameProcess = () => {
      const matchingProcesses = findRunningEpicGameProcesses(
        appId,
        installPath,
        child.pid
      )

      if (matchingProcesses.length > 0) {
        lastDetectedAt = Date.now()
        lastDetectedPid = Number(matchingProcesses[0])

        if (!started) {
          started = true
          startedAt = lastDetectedAt
          lifecycle.onStarted?.()
          clearTimeout(startupTimeout)
        }

        return
      }

      if (
        started &&
        Date.now() - lastDetectedAt >= 2500
      ) {
        const runtimeMs = lastDetectedAt - startedAt

        if (runtimeMs < 10000) {
          const runtimeSeconds =
            Math.max(0, runtimeMs / 1000).toFixed(1)
          const details = output.trim()

          finish({
            success: false,
            error: details
              ? `Game exited ${runtimeSeconds}s after launch. ${details}`
              : `Game exited ${runtimeSeconds}s after launch. Check the Wine/graphics output in the terminal.`,
          }, true)
        } else {
          lifecycle.onExited?.()
          finish({
            success: true,
            appId: String(appId),
            pid: lastDetectedPid,
          })
        }
      } else if (
        !started &&
        cliExitCode !== null &&
        cliExitCode !== 0
      ) {
        finish({
          success: false,
          error:
            output.trim() || `Legendary exited with code ${cliExitCode}`,
        }, true)
      }
    }

    child.stdout.setEncoding('utf8')
    child.stderr.setEncoding('utf8')
    child.stdout.on('data', collectOutput)
    child.stderr.on('data', collectOutput)
    child.on('error', (error) => {
      finish({ success: false, error: error.message }, true)
    })
    child.on('close', (code) => {
      cliExitCode = code
      checkGameProcess()
    })

    startupTimeout = setTimeout(() => {
      finish({
        success: false,
        error:
          output.trim() ||
          'Legendary exited without a detectable game process. Check the game-specific Wine or graphics requirements.',
      }, true)
    }, 20000)

    processMonitor = setInterval(checkGameProcess, 250)
    child.unref()
  })
}

module.exports = {
  getConnectionStatus,
  getOperation,
  listInstalledGames,
  listOwnedGames,
  launchGame,
  startOperation,
}