const https = require('https')

const API_BASE =
  'https://www.steamgriddb.com/api/v2'

function getApiKey() {
  const apiKey =
    process.env.STEAMGRIDDB_API_KEY

  if (!apiKey) {
    throw new Error(
      'STEAMGRIDDB_API_KEY is not configured'
    )
  }

  return apiKey
}

function getJson(path) {
  return new Promise((resolve, reject) => {
    const request = https.get(
      `${API_BASE}${path}`,
      {
        headers: {
          Authorization:
            `Bearer ${getApiKey()}`,
          Accept: 'application/json',
        },
      },
      (response) => {
        let body = ''

        response.setEncoding('utf8')

        response.on('data', (chunk) => {
          body += chunk
        })

        response.on('end', () => {
          if (response.statusCode !== 200) {
            reject(
              new Error(
                `SteamGridDB HTTP ${response.statusCode}: ${body}`
              )
            )

            return
          }

          try {
            resolve(JSON.parse(body))
          } catch (error) {
            reject(error)
          }
        })
      }
    )

    request.on('error', reject)

    request.setTimeout(10000, () => {
      request.destroy()

      reject(
        new Error(
          'SteamGridDB request timed out'
        )
      )
    })
  })
}

/*
 * Resolve a Steam AppID directly to a
 * SteamGridDB game.
 */
async function getGameBySteamAppId(appId) {
  const response =
    await getJson(
      `/games/steam/${encodeURIComponent(appId)}`
    )

  if (
    !response.success ||
    !response.data
  ) {
    return null
  }

  return response.data
}

async function getGameByName(name) {
  const response =
    await getJson(
      `/search/autocomplete/${encodeURIComponent(name)}`
    )

  if (
    !response.success ||
    !Array.isArray(response.data) ||
    response.data.length === 0
  ) {
    return null
  }

  const normalizedName =
    String(name).trim().toLowerCase()

  return response.data.find(
    (game) =>
      String(game.name).trim().toLowerCase() ===
      normalizedName
  ) ?? response.data[0]
}

/*
 * Get a 600x900 static grid.
 *
 * We prefer the Steam-style vertical artwork
 * used by our launcher cards.
 */
async function getGridForGame(gameId) {
  const response =
    await getJson(
      `/grids/game/${encodeURIComponent(gameId)}` +
      '?dimensions=600x900' +
      '&types=static'
    )

  if (
    !response.success ||
    !Array.isArray(response.data) ||
    response.data.length === 0
  ) {
    return null
  }

  return response.data[0].url ?? null
}

async function getSteamGridArtwork(appId) {
  const game =
    await getGameBySteamAppId(appId)

  if (!game) {
    return null
  }

  const coverImage =
    await getGridForGame(game.id)

  return {
    gameId: game.id,
    name: game.name ?? null,
    coverImage,
  }
}

async function getSteamGridArtworkByName(name) {
  const game = await getGameByName(name)

  if (!game) {
    return null
  }

  return {
    gameId: game.id,
    name: game.name ?? null,
    coverImage: await getGridForGame(game.id),
  }
}

async function getGridOptionsForGame(
  gameId,
  limit = 12
) {
  const response =
    await getJson(
      `/grids/game/${encodeURIComponent(gameId)}` +
      '?dimensions=600x900' +
      '&types=static'
    )

  if (
    !response.success ||
    !Array.isArray(response.data)
  ) {
    return []
  }

  return response.data
    .filter((grid) => grid.url)
    .slice(0, limit)
    .map((grid) => ({
      id: grid.id,
      url: grid.url,
      width: grid.width ?? null,
      height: grid.height ?? null,
      score: grid.score ?? null,
    }))
}

async function getSteamGridArtworkOptions(
  appId,
  limit = 12
) {
  const game =
    await getGameBySteamAppId(appId)

  if (!game) {
    return {
      game: null,
      artwork: [],
    }
  }

  const artwork =
    await getGridOptionsForGame(
      game.id,
      limit
    )

  return {
    game: {
      id: game.id,
      name: game.name ?? null,
    },
    artwork,
  }
}

async function getSteamGridArtworkOptionsByName(
  name,
  limit = 12
) {
  const game = await getGameByName(name)

  if (!game) {
    return {
      game: null,
      artwork: [],
    }
  }

  return {
    game: {
      id: game.id,
      name: game.name ?? null,
    },
    artwork: await getGridOptionsForGame(game.id, limit),
  }
}

module.exports = {
  getGameBySteamAppId,
  getGameByName,
  getGridForGame,
  getSteamGridArtwork,
  getSteamGridArtworkByName,
  getGridOptionsForGame,
  getSteamGridArtworkOptions,
  getSteamGridArtworkOptionsByName,
}