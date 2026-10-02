const {
  spawn,
} = require('child_process')

function runSteamUri(uri) {
  try {
    console.log(
      `Opening Steam URI: ${uri}`
    )

    const child = spawn(
      'steam',
      [
        '-silent',
        uri,
      ],
      {
        detached: true,
        stdio: 'ignore',
      }
    )

    child.unref()

    return {
      success: true,
      uri,
    }
  } catch (error) {
    console.error(
      `Failed to open Steam URI ${uri}:`,
      error
    )

    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Unknown Steam error',
    }
  }
}

function installSteamGame(appId) {
  if (!appId) {
    return {
      success: false,
      error: 'Missing Steam AppID',
    }
  }

  const installTarget =
    `steam://install/${appId}`

  console.log(
    `Requesting Steam install: ${installTarget}`
  )

  return {
    ...runSteamUri(installTarget),
    appId,
    installTarget,
  }
}

function uninstallSteamGame(appId) {
  if (!appId) {
    return {
      success: false,
      error: 'Missing Steam AppID',
    }
  }

  const uninstallTarget =
    `steam://uninstall/${appId}`

  console.log(
    `Requesting Steam uninstall: ${uninstallTarget}`
  )

  return {
    ...runSteamUri(uninstallTarget),
    appId,
    uninstallTarget,
  }
}

module.exports = {
  installSteamGame,
  uninstallSteamGame,
}