const https = require('https')

function getJson(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (response) => {
        if (response.statusCode !== 200) {
          response.resume()

          reject(
            new Error(
              `Steam API returned HTTP ${response.statusCode}`
            )
          )

          return
        }

        let body = ''

        response.setEncoding('utf8')

        response.on('data', (chunk) => {
          body += chunk
        })

        response.on('end', () => {
          try {
            resolve(JSON.parse(body))
          } catch (error) {
            reject(error)
          }
        })
      })
      .on('error', reject)
  })
}

async function getOwnedSteamGames() {
  const apiKey =
    process.env.STEAM_WEB_API_KEY

  const steamId =
    process.env.STEAM_ID

  if (!apiKey) {
    throw new Error(
      'STEAM_WEB_API_KEY is not configured'
    )
  }

  if (!steamId) {
    throw new Error(
      'STEAM_ID is not configured'
    )
  }

  const params =
    new URLSearchParams({
      key: apiKey,
      steamid: steamId,
      include_appinfo: 'true',
      include_played_free_games: 'true',
      format: 'json',
    })

  const url =
    `https://api.steampowered.com/IPlayerService/GetOwnedGames/v0001/?${params.toString()}`

  const data = await getJson(url)

  const games =
    data?.response?.games ?? []

  return games.map((game) => ({
    appId: String(game.appid),
    name: game.name ?? `Steam App ${game.appid}`,
    playtimeMinutes:
      game.playtime_forever ?? 0,
  }))
}

module.exports = {
  getOwnedSteamGames,
}