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

  try {
    const child = spawn(
      'steam',
      [launchTarget],
      {
        detached: true,
        stdio: 'ignore',
      }
    )

    child.unref()

    return {
      success: true,
    }
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Failed to launch Steam game',
    }
  }
}

module.exports = {
  launchSteam,
}
