const { execFile } = require('child_process')

function getRunningProcesses() {
  return new Promise((resolve, reject) => {
    execFile(
      'ps',
      ['-eo', 'pid,args'],
      {
        maxBuffer: 1024 * 1024 * 10,
      },
      (error, stdout) => {
        if (error) {
          reject(error)
          return
        }

        resolve(stdout)
      }
    )
  })
}

async function findProcessesMatching(searchTerms) {
  const processList = await getRunningProcesses()

  const terms = searchTerms
    .filter(Boolean)
    .map((term) => term.toLowerCase())

  if (terms.length === 0) {
    return []
  }

  return processList
    .split('\n')
    .filter((line) => {
      const normalized = line.toLowerCase()

      return terms.some((term) =>
        normalized.includes(term)
      )
    })
}

async function isSteamGameRunning(appId) {
  const processList = await getRunningProcesses()

  const pattern = new RegExp(
    `SteamLaunch\\s+AppId=${String(appId)}(?:\\s|$)`
  )

  return processList
    .split('\n')
    .some((line) => pattern.test(line))
}

module.exports = {
  getRunningProcesses,
  findProcessesMatching,
  isSteamGameRunning,
}
