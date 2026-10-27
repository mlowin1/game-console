const https = require('https')
const { getDatabase } = require('../database/db.cjs')

const CACHE_DAYS = 7
const MIN_PROTONDB_REPORTS = 10
const ANTI_CHEAT_URL =
  'https://raw.githubusercontent.com/AreWeAntiCheatYet/AreWeAntiCheatYet/HEAD/games.json'

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const request = https.get(
      url,
      { headers: { Accept: 'application/json', 'User-Agent': 'FinalForm' } },
      (response) => {
        if (response.statusCode === 404) {
          response.resume()
          resolve(null)
          return
        }

        if (response.statusCode !== 200) {
          response.resume()
          reject(new Error(`HTTP ${response.statusCode} from ${new URL(url).hostname}`))
          return
        }

        let body = ''
        response.setEncoding('utf8')
        response.on('data', (chunk) => { body += chunk })
        response.on('end', () => {
          try {
            resolve(JSON.parse(body))
          } catch (error) {
            reject(error)
          }
        })
      }
    )

    request.on('error', reject)
    request.setTimeout(15000, () => {
      request.destroy(new Error('Request timed out'))
    })
  })
}

function normalizeTitle(title) {
  return String(title)
    .toLowerCase()
    .replace(/[™®©]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

// "Denied" = the developer blocks Linux/Proton; "Broken" = anti-cheat currently fails there.
function buildAntiCheatIndex(entries) {
  const bySteamId = new Map()
  const byTitle = new Map()

  for (const entry of entries ?? []) {
    if (entry.status !== 'Denied' && entry.status !== 'Broken') continue

    if (entry.storeIds?.steam) {
      bySteamId.set(String(entry.storeIds.steam), entry)
    }

    byTitle.set(normalizeTitle(entry.name), entry)
  }

  return { bySteamId, byTitle }
}

async function hasNativeLinux(steamId, fetch) {
  const data = await fetch(
    `https://store.steampowered.com/api/appdetails?appids=${encodeURIComponent(steamId)}&filters=platforms`
  )

  return data?.[steamId]?.data?.platforms?.linux === true
}

function blocked(reason, source, referenceUrl = null) {
  return { verdict: 'blocked', reason, source, referenceUrl }
}

async function checkGame(game, index, fetch) {
  const entry =
    (game.steamId && index.bySteamId.get(game.steamId)) ||
    index.byTitle.get(normalizeTitle(game.title))

  if (entry) {
    const anticheat = entry.anticheats?.length
      ? entry.anticheats.join(', ')
      : 'Anti-cheat'
    const reference = entry.reference || null

    if (entry.status === 'Denied') {
      return blocked(
        `${anticheat} blocks Linux and Proton.`,
        'areweanticheatyet',
        reference
      )
    }

    const native = game.steamId
      ? await hasNativeLinux(game.steamId, fetch)
      : false

    if (!native) {
      return blocked(
        `${anticheat} does not currently work on Linux.`,
        'areweanticheatyet',
        reference
      )
    }
  }

  if (!game.steamId) {
    return { verdict: entry ? 'ok' : 'unknown' }
  }

  if (await hasNativeLinux(game.steamId, fetch)) {
    return { verdict: 'ok' }
  }

  const summary = await fetch(
    `https://www.protondb.com/api/v1/reports/summaries/${encodeURIComponent(game.steamId)}.json`
  )

  if (summary?.tier === 'borked' && summary.total >= MIN_PROTONDB_REPORTS) {
    return blocked(
      `Reported as not working through Proton (${summary.total} ProtonDB reports).`,
      'protondb',
      `https://www.protondb.com/app/${game.steamId}`
    )
  }

  return { verdict: 'ok' }
}

async function runRefresh({ force, fetch, delayMs }) {
  const db = getDatabase()

  const rows = db.prepare(`
    SELECT
      g.id,
      g.title,
      (
        SELECT gs.store_game_id
        FROM game_sources gs
        WHERE gs.game_id = g.id AND gs.store = 'steam'
        LIMIT 1
      ) AS steam_id
    FROM games g
    LEFT JOIN game_compatibility c ON c.game_id = g.id
    WHERE ? = 1
      OR c.game_id IS NULL
      OR datetime(c.checked_at) <= datetime('now', '-' || ? || ' days')
  `).all(force ? 1 : 0, CACHE_DAYS)

  const result = { checked: 0, blocked: 0, failed: 0 }

  if (rows.length === 0) return result

  const index = buildAntiCheatIndex(await fetch(ANTI_CHEAT_URL))

  const save = db.prepare(`
    INSERT INTO game_compatibility (
      game_id, verdict, reason, source, reference_url, checked_at
    )
    VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(game_id) DO UPDATE SET
      verdict = excluded.verdict,
      reason = excluded.reason,
      source = excluded.source,
      reference_url = excluded.reference_url,
      checked_at = excluded.checked_at
  `)

  for (const row of rows) {
    try {
      const verdict = await checkGame(
        { title: row.title, steamId: row.steam_id },
        index,
        fetch
      )

      save.run(
        row.id,
        verdict.verdict,
        verdict.reason ?? null,
        verdict.source ?? null,
        verdict.referenceUrl ?? null
      )

      result.checked += 1
      if (verdict.verdict === 'blocked') result.blocked += 1
    } catch {
      // Network errors leave the row unchecked so the next refresh retries it.
      result.failed += 1
    }

    if (delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs))
    }
  }

  return result
}

let refreshPromise = null

function refreshCompatibility({
  force = false,
  fetch = fetchJson,
  delayMs = 200,
} = {}) {
  if (!refreshPromise) {
    refreshPromise = runRefresh({ force, fetch, delayMs }).finally(() => {
      refreshPromise = null
    })
  }

  return refreshPromise
}

module.exports = {
  refreshCompatibility,
}
