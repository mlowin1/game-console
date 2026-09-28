const https = require('https')

function getJson(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (response) => {
        if (
          response.statusCode &&
          response.statusCode >= 300 &&
          response.statusCode < 400 &&
          response.headers.location
        ) {
          response.resume()

          getJson(
            response.headers.location
          )
            .then(resolve)
            .catch(reject)

          return
        }

        if (response.statusCode !== 200) {
          response.resume()

          reject(
            new Error(
              `HTTP ${response.statusCode}`
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

async function getSteamMetadata(appId) {
  const url =
    `https://store.steampowered.com/api/appdetails?appids=${encodeURIComponent(appId)}`

  const response =
    await getJson(url)

  const entry =
    response[String(appId)]

  if (
    !entry ||
    !entry.success ||
    !entry.data
  ) {
    return null
  }

  const data = entry.data

  const assetBase =
    `https://shared.steamstatic.com/store_item_assets/steam/apps/${encodeURIComponent(appId)}`

  return {
    appId: String(appId),

    title:
      data.name ?? null,

    description:
      data.short_description ?? null,

    coverImage:
      `${assetBase}/library_600x900_2x.jpg`,

    heroImage:
      `${assetBase}/library_hero.jpg`,

    logoImage:
      `${assetBase}/logo.png`,

    fallbackCoverImage:
      data.header_image ?? null,

    fallbackHeroImage:
      data.background_raw ??
      data.background ??
      null,
  }
}

module.exports = {
  getSteamMetadata,
}
