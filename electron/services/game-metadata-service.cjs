const {
  getDatabase,
} = require('../database/db.cjs')

const {
  getSteamMetadata,
  getSteamMetadataByTitle,
} = require('./steam-metadata-service.cjs')

const {
  getEpicMetadata,
} = require('./epic-metadata-service.cjs')

const {
  getSteamGridArtwork,
  getSteamGridArtworkByName,
} = require('./steamgriddb-service.cjs')

/*
 * Metadata is considered fresh for seven days.
 *
 * This prevents us from calling Steam and
 * SteamGridDB every time the launcher starts.
 */
const METADATA_MAX_AGE_DAYS = 7

async function refreshSteamMetadata({
  force = false,
  store = null,
} = {}) {
  const db = getDatabase()
  const storeFilter = store
    ? 'AND gs.store = ?'
    : ''
  const storeParams = store ? [store] : []

  let sources

  /*
   * A forced refresh ignores the cache.
   *
   * We'll eventually expose this through a
   * "Refresh Metadata" option in the UI.
   */
  if (force) {
    sources = db.prepare(`
      SELECT
        gs.game_id,
        gs.store,
        gs.store_game_id,
        g.title,
        g.description,
        g.cover_image,
        g.hero_image,
        g.logo_image,
        g.cover_source
      FROM game_sources gs
      JOIN games g
        ON g.id = gs.game_id
      WHERE gs.store IN ('steam', 'epic')
        ${storeFilter}
    `).all(...storeParams)
  } else {
    /*
     * Normal startup only refreshes games whose
     * metadata has never been checked or is older
     * than our cache lifetime.
     */
    sources = db.prepare(`
      SELECT
        gs.game_id,
        gs.store,
        gs.store_game_id,
        g.title,
        g.description,
        g.cover_image,
        g.hero_image,
        g.logo_image,
        g.cover_source
      FROM game_sources gs
      JOIN games g
        ON g.id = gs.game_id
      WHERE gs.store IN ('steam', 'epic')
        ${storeFilter}
        AND (
          g.metadata_refreshed_at IS NULL
          OR datetime(
            g.metadata_refreshed_at
          ) <= datetime(
            'now',
            '-' || ? || ' days'
          )
        )
    `).all(
      ...storeParams,
      METADATA_MAX_AGE_DAYS
    )
  }

  let updated = 0
  let failed = 0
  let skipped = 0

  for (const source of sources) {
    try {
      let metadata = null

      /*
       * Steam is our primary metadata provider.
       */
      if (source.store === 'epic') {
        try {
          metadata =
            getEpicMetadata(
              source.store_game_id
            )

          const hasEpicDescription =
            metadata?.description &&
            metadata.description.trim().toLowerCase() !==
              source.title.trim().toLowerCase()

          if (
            !hasEpicDescription ||
            !metadata?.heroImage
          ) {
            const storefrontMetadata =
              await getSteamMetadataByTitle(
                source.title
              )

            if (storefrontMetadata) {
              metadata = {
                ...metadata,
                description:
                  hasEpicDescription
                    ? metadata.description
                    : storefrontMetadata.description,
                heroImage:
                  metadata?.heroImage ??
                  storefrontMetadata.heroImage,
                logoImage:
                  metadata?.logoImage ??
                  storefrontMetadata.logoImage,
              }
            }
          }
        } catch (error) {
          console.warn(
            `Epic metadata unavailable for ${source.store_game_id}:`,
            error.message
          )
        }
      } else {
        try {
          metadata =
            await getSteamMetadata(
              source.store_game_id
            )
        } catch (error) {
          console.warn(
            `Steam metadata unavailable for ${source.store_game_id}:`,
            error.message
          )
        }
      }

      let description =
        metadata?.description ??
        source.description ??
        null

      if (
        source.store === 'epic' &&
        !description
      ) {
        description =
          'Available on the Epic Games Store.'
      }

      if (
        source.store === 'epic' &&
        metadata?.title &&
        !source.title
      ) {
        db.prepare(`
          UPDATE games
          SET title = ?
          WHERE id = ?
        `).run(
          metadata.title,
          source.game_id
        )
      }

      let coverImage =
        metadata?.coverImage ??
        source.cover_image ??
        null

      const heroImage =
        metadata?.heroImage ??
        source.hero_image ??
        null

      const logoImage =
        metadata?.logoImage ??
        source.logo_image ??
        null

      let coverSource =
        source.cover_source ??
        null

      /*
       * If Steam supplied a valid vertical cover,
       * record Steam as the provider.
       */
      if (metadata?.coverImage) {
        coverSource = 'steam'
      }

      /*
       * If we still have no cover, ask
       * SteamGridDB for a 600x900 grid.
       */
      if (!coverImage) {
        try {
          const gridArtwork =
            source.store === 'epic'
              ? await getSteamGridArtworkByName(
                  source.title
                )
              : await getSteamGridArtwork(
                  source.store_game_id
                )

          if (gridArtwork?.coverImage) {
            coverImage =
              gridArtwork.coverImage

            coverSource =
              'steamgriddb'

            console.log(
              `SteamGridDB fallback: ${source.title}`
            )
          }
        } catch (error) {
          console.warn(
            `SteamGridDB fallback failed for ${source.store_game_id}:`,
            error.message
          )
        }
      }

      const hasUsefulMetadata =
        Boolean(
          description ||
          coverImage ||
          heroImage ||
          logoImage
        )

      /*
       * Even a legitimate "nothing found" result
       * gets cached. Otherwise we'd retry the same
       * unavailable metadata on every startup.
       */
      if (!hasUsefulMetadata) {
        db.prepare(`
          UPDATE games
          SET
            metadata_refreshed_at = CURRENT_TIMESTAMP,
            metadata_refresh_status = 'no_metadata'
          WHERE id = ?
        `).run(
          source.game_id
        )

        console.warn(
          `No metadata available for ${source.title}`
        )

        skipped += 1
        continue
      }

      db.prepare(`
        UPDATE games
        SET
          description = COALESCE(?, description),
          cover_image = COALESCE(?, cover_image),
          hero_image = COALESCE(?, hero_image),
          logo_image = COALESCE(?, logo_image),
          cover_source = COALESCE(?, cover_source),
          metadata_refreshed_at = CURRENT_TIMESTAMP,
          metadata_refresh_status = 'complete'
        WHERE id = ?
      `).run(
        description,
        coverImage,
        heroImage,
        logoImage,
        coverSource,
        source.game_id
      )

      console.log(
        `Updated metadata: ${source.title}`
      )

      updated += 1
    } catch (error) {
      /*
       * Don't update metadata_refreshed_at for a
       * real failure. That allows a later startup
       * to retry transient API/network errors.
       */
      db.prepare(`
        UPDATE games
        SET metadata_refresh_status = 'failed'
        WHERE id = ?
      `).run(
        source.game_id
      )

      console.error(
        `Metadata refresh failed for ${source.store_game_id}:`,
        error.message
      )

      failed += 1
    }
  }

  return {
    updated,
    failed,
    skipped,
  }
}

module.exports = {
  refreshSteamMetadata,
}