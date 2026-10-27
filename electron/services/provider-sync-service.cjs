const { getDatabase } = require('../database/db.cjs')

function sanitizeError(error) {
  return String(error || 'Unknown sync error')
    .replace(/(-AUTH_PASSWORD=)\S+/gi, '$1[redacted]')
    .replace(/((?:access_token|refresh_token|authorizationCode|exchangeToken)["']?\s*[:=]\s*["']?)[^\s"']+/gi, '$1[redacted]')
    .slice(0, 500)
}

function recordProviderSync(store, {
  success,
  gameCount = 0,
  error = null,
}) {
  const db = getDatabase()
  const syncState = success ? 'connected' : 'error'

  db.prepare(`
    INSERT INTO provider_syncs (
      store,
      sync_state,
      last_attempt_at,
      last_success_at,
      game_count,
      error
    )
    VALUES (
      ?,
      ?,
      CURRENT_TIMESTAMP,
      CASE WHEN ? = 1 THEN CURRENT_TIMESTAMP ELSE NULL END,
      ?,
      ?
    )
    ON CONFLICT(store) DO UPDATE SET
      sync_state = excluded.sync_state,
      last_attempt_at = excluded.last_attempt_at,
      last_success_at = CASE
        WHEN excluded.sync_state = 'connected'
          THEN excluded.last_success_at
        ELSE provider_syncs.last_success_at
      END,
      game_count = CASE
        WHEN excluded.sync_state = 'connected'
          THEN excluded.game_count
        ELSE provider_syncs.game_count
      END,
      error = excluded.error
  `).run(
    store,
    syncState,
    success ? 1 : 0,
    Number.isInteger(gameCount) ? gameCount : 0,
    success ? null : sanitizeError(error)
  )

  return getProviderSyncStatus()[store]
}

function getProviderSyncStatus() {
  const db = getDatabase()
  const rows = db.prepare(`
    SELECT
      store,
      sync_state,
      last_attempt_at,
      last_success_at,
      game_count,
      error
    FROM provider_syncs
  `).all()
  const byStore = new Map(rows.map((row) => [row.store, row]))

  return Object.fromEntries(['steam', 'epic'].map((store) => {
    const row = byStore.get(store)
    return [store, {
      store,
      syncState: row?.sync_state ?? 'never',
      lastAttemptAt: row?.last_attempt_at ?? null,
      lastSuccessAt: row?.last_success_at ?? null,
      gameCount: row?.game_count ?? 0,
      error: row?.error ?? null,
    }]
  }))
}

module.exports = {
  getProviderSyncStatus,
  recordProviderSync,
}