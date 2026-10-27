# FinalForm web accounts

Standalone Node 22+ account service under `account-web/`. The existing Electron renderer, preload, and local SQLite library database are untouched. The server uses `better-sqlite3` and its own migrated SQLite database. The account site opens directly into sign-in and registration rather than a landing page.

## Development

```bash
cd account-web
npm install
cp .env.example .env
npm run dev
# open http://localhost:3001
npm test
```

Export environment variables through your shell or load `.env` using Node's `--env-file=.env` option (`node --env-file=.env server.mjs`). The Node server does **not** automatically load `.env` with dotenv. The default database is `account-web/data/accounts.db`; `.env` files, SQLite databases and WAL files must never be committed. Run a reverse proxy with TLS when deployed publicly. Set `PUBLIC_ORIGIN` to its public HTTPS origin, `NODE_ENV=production`, and `PORT` appropriately. This repository intentionally has no production email transport: `REQUIRE_EMAIL_VERIFICATION=false` is the supported local setting and new accounts are automatically marked verified; `REQUIRE_EMAIL_VERIFICATION=true` allows link-based verification only if you implement an SMTP adapter before production. For local verification testing, set `DEV_LOG_VERIFICATION_LINKS=true` to print the single-use link into server logs. This is **never** enabled in production. Do not enable required verification in production until SMTP delivery and resend support are implemented.

## Security notes

Password hashes: Node scrypt N=32768,r=8,p=1 with per-user random 16-byte salt. Web sessions are random 256-bit bearer cookie IDs, stored server-side by SHA-256 hash, 7-day validity, HttpOnly + SameSite=Strict, Secure in production. CSRF tokens are scoped to sessions, rendered only to same-origin authenticated JavaScript, and checked on mutations; strict Origin and Fetch Metadata checks, CSP, and JSON content-type enforcement are also used. Native grant credentials are random, server-hashed secrets; access tokens expire in 15 minutes, rotating refresh tokens in 30 days. Device codes expire in 10 minutes, are single-use, and polling starts at five seconds, with incremental `slow_down` backoff. No password ever travels to Electron.

**Deployment hardening required:** The in-process login throttle is not sufficient for a horizontally scaled or high-risk public deployment. Add shared persistent IP/account rate limiting at the reverse proxy and operational monitoring. SMTP verification is not ready for public production. The device-code approve step requires a signed-in session and explicit user confirmation. Public account registration should be subject to abuse prevention at ingress. Keep the server database and its backups private. Avoid exposing device tokens to browser JavaScript.

## Electron integration boundary

Expose only safe operations via `contextBridge`: `beginAccountLink()`, `getAccountLinkStatus()`, `cancelAccountLink()`, `getLinkedAccount()`, and `unlinkAccount()`. The Electron **main process** performs all HTTP requests and secret handling. Its `device_code` stays in main-process memory; its refresh token must be persisted using Linux Secret Service via libsecret/OS credential store, never in SQLite, localStorage, preload-exposed objects, or renderer-accessible storage. The renderer displays `user_code`, `verification_uri`, the countdown, pending and final states only. Electron's `contextIsolation: true`, `sandbox: true`, and `nodeIntegration: false` must remain. Secure-store failures must fail closed and should not fall back to files. See `API.md` for the exact versioned contract.
