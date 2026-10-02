const fs = require('fs')
const os = require('os')
const path = require('path')
const {
  scanEpicInstallation,
  normalizeAppId,
} = require('../integrations/epic/scanner.cjs')

function readLegendaryMetadata(appId) {
  const configHome =
    process.env.XDG_CONFIG_HOME ||
    path.join(os.homedir(), '.config')
  const metadataDirectory = path.join(
    configHome,
    'legendary',
    'metadata'
  )
  const metadataPath = path.join(
    metadataDirectory,
    `${appId}.json`
  )

  try {
    const cached = JSON.parse(
      fs.readFileSync(metadataPath, 'utf8')
    )

    if (
      normalizeAppId(cached.app_name) ===
      normalizeAppId(appId)
    ) {
      return cached
    }
  } catch {}

  return null
}

function chooseImage(keyImages, predicate) {
  return keyImages
    .filter((image) =>
      image?.url &&
      image.width > 0 &&
      image.height > 0 &&
      predicate(image)
    )
    .sort((left, right) =>
      (right.width * right.height) -
      (left.width * left.height)
    )[0]?.url ?? null
}

function getEpicMetadata(appId) {
  const normalizedAppId =
    normalizeAppId(appId)

  const cached = readLegendaryMetadata(appId)
  const catalog = cached?.metadata ?? {}
  const title =
    cached?.app_title ||
    catalog.title ||
    null
  const descriptionCandidates = [
    catalog.description,
    catalog.longDescription,
  ].filter((value) =>
    typeof value === 'string' &&
    value.trim().length > 12 &&
    normalizeAppId(value) !== normalizeAppId(title)
  )
  const keyImages = Array.isArray(catalog.keyImages)
    ? catalog.keyImages
    : []
  const cachedMetadata = {
    title,
    description: descriptionCandidates[0]?.trim() ?? null,
    coverImage: chooseImage(
      keyImages,
      (image) =>
        /tall|portrait/i.test(image.type || '') ||
        image.height / image.width > 1.15
    ),
    heroImage: chooseImage(
      keyImages,
      (image) =>
        image.width / image.height > 1.5 &&
        image.width >= 1200
    ),
    logoImage: chooseImage(
      keyImages,
      (image) => /logo/i.test(image.type || '')
    ),
  }

  const discovered = scanEpicInstallation()

  const match = discovered.find(
    (entry) =>
      normalizeAppId(entry.appId) ===
      normalizedAppId
  )

  if (!match) {
    return {
      ...cachedMetadata,
      installPath: null,
      launchTarget: null,
    }
  }

  return {
    ...cachedMetadata,
    title: cachedMetadata.title || match.title || null,
    description:
      cachedMetadata.description ||
      match.description ||
      'Available on the Epic Games Store.',
    installPath: match.installPath || null,
    launchTarget:
      match.launchTarget ||
      `com.epicgames.launcher://launch/${match.appId}`,
  }
}

module.exports = {
  getEpicMetadata,
}
