const {
  isSteamGameRunning,
} = require('./game-process-service.cjs')

async function main() {
  const appId = '606150'

  const running =
    await isSteamGameRunning(appId)

  console.log(
    `Steam AppID ${appId} running: ${running}`
  )
}

main().catch(console.error)
