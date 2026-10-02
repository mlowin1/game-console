const {
  getSteamInstallStatus,
} = require(
  './steam-install-status-service.cjs'
)

const appId =
  process.argv[2]

if (!appId) {
  console.error(
    'Usage: node electron/services/test-steam-install-status.cjs <AppID>'
  )

  process.exit(1)
}

const status =
  getSteamInstallStatus(
    appId
  )

console.dir(
  status,
  {
    depth: null,
  }
)