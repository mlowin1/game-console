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

          getJson(response.headers.location)
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

/*
 * Check whether an image URL actually resolves.
 *
 * We use a small GET request instead of HEAD because
 * some CDNs do not handle HEAD consistently.
 */
function imageExists(url) {
  if (!url) {
    return Promise.resolve(false)
  }

  return new Promise((resolve) => {
    const request = https.get(
      url,
      {
        headers: {
          Range: 'bytes=0-0',
        },
      },
      (response) => {
        const statusCode =
          response.statusCode ?? 0

        /*
         * Follow redirects.
         */
        if (
          statusCode >= 300 &&
          statusCode < 400 &&
          response.headers.location
        ) {
          const redirectUrl =
            new URL(
              response.headers.location,
              url
            ).toString()

          response.resume()

          imageExists(redirectUrl)
            .then(resolve)
            .catch(() => resolve(false))

          return
        }

        const contentType =
          response.headers['content-type'] ?? ''

        const valid =
          (statusCode === 200 ||
            statusCode === 206) &&
          contentType.startsWith('image/')

        response.resume()
        resolve(valid)
      }
    )

    request.on('error', () => {
      resolve(false)
    })

    request.setTimeout(5000, () => {
      request.destroy()
      resolve(false)
    })
  })
}

async function firstValidImage(candidates) {
  for (const candidate of candidates) {
    if (!candidate) {
      continue
    }

    if (await imageExists(candidate)) {
      return candidate
    }
  }

  return null
}

async function getSteamMetadata(appId) {
  const encodedAppId =
    encodeURIComponent(appId)

  const url =
    `https://store.steampowered.com/api/appdetails?appids=${encodedAppId}`

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
    `https://shared.steamstatic.com/store_item_assets/steam/apps/${encodedAppId}`

  /*
   * Preferred Steam library artwork.
   */
  const libraryCover =
    `${assetBase}/library_600x900_2x.jpg`

  const libraryHero =
    `${assetBase}/library_hero.jpg`

  const libraryLogo =
    `${assetBase}/logo.png`

  /*
   * Store API artwork gives us useful fallbacks
   * for games that do not expose all of the
   * standard Steam library assets.
   */
  const coverImage =
    await firstValidImage([
      libraryCover,
      data.header_image,
    ])

  const heroImage =
    await firstValidImage([
      libraryHero,
      data.background_raw,
      data.background,
      data.header_image,
    ])

  const logoImage =
    await firstValidImage([
      libraryLogo,
    ])

  return {
    appId: String(appId),

    title:
      data.name ?? null,

    description:
      data.short_description ?? null,

    coverImage,

    heroImage,

    logoImage,
  }
}

async function getSteamMetadataByTitle(title) {
  const url =
    `https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(title)}` +
    '&l=en&cc=US'

  const search = await getJson(url)
  const normalizedTitle =
    String(title).trim().toLowerCase()
  const match = (search.items ?? []).find(
    (item) =>
      String(item.name).trim().toLowerCase() ===
      normalizedTitle
  )

  return match
    ? getSteamMetadata(String(match.id))
    : null
}

module.exports = {
  getSteamMetadata,
  getSteamMetadataByTitle,
  imageExists,
  firstValidImage,
}