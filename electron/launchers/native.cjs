const { spawn } = require('child_process')
const fs = require('fs')

function launchNative(target) {
  if (!target) {
    throw new Error('Native launch target is missing')
  }

  if (!fs.existsSync(target)) {
    throw new Error(`Launch target does not exist: ${target}`)
  }

  const child = spawn(target, [], {
    detached: true,
    stdio: 'ignore',
  })

  child.unref()

  return {
    success: true,
  }
}

module.exports = {
  launchNative,
}
