const { spawn } = require('child_process')

function launchSteam(launchTarget) {
  if (!launchTarget) {
    return {
      success: false,
      error: 'No Steam launch target provided',
    }
  }

  if (!launchTarget.startsWith('steam://')) {
    return {
      success: false,
      error: `Invalid Steam launch target: ${launchTarget}`,
    }
  }

  console.log(`Launching Steam target: ${launchTarget}`)

  return new Promise((resolve) => {
    const child = spawn(
      'steam',
      [launchTarget],
      {
        detached: true,
        stdio: 'ignore',
      }
    )

    let settled = false
    const finish = (result) => {
      if (settled) return
      settled = true
      resolve(result)
    }

    child.once('spawn', () => {
      child.unref()
      finish({
        success: true,
        pid: child.pid,
      })
    })

    child.once('error', (error) => {
      finish({
        success: false,
        error: error.message,
      })
    })

    child.once('close', (code) => {
      if (!settled && code !== 0) {
        finish({
          success: false,
          error: `Steam exited with code ${code}`,
        })
      }
    })
  })
}

module.exports = {
  launchSteam,
}
