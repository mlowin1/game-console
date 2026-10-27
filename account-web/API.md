# FinalForm Account API — v1

Base URL: `https://<account-host>/api/v1` in production. All JSON endpoints require `Content-Type: application/json` for POST. Responses have `Cache-Control: no-store`. No browser CORS credentials are enabled. `client_id` is the fixed public identifier `finalform-linux` (not a client secret). All POSTs carry JSON; values are case-sensitive except normalized user codes.

## Public launcher device endpoints

### POST `/device/authorize`
Request: `{"client_id":"finalform-linux"}`
Response 200: `{"device_code":"opaque-secret","user_code":"ABCD-EFGH","verification_uri":"https://<host>/verify","verification_uri_complete":"https://<host>/verify?user_code=ABCD-EFGH","expires_in":600,"interval":5}`.
Only `user_code`, verification URI and expiry should enter the renderer; never reveal `device_code` there.

### POST `/device/token` — polling
Request: `{"grant_type":"urn:ietf:params:oauth:grant-type:device_code","client_id":"finalform-linux","device_code":"opaque-secret"}`.
Pending: HTTP 400 `{"error":"authorization_pending","error_description":"authorization_pending"}`.
Denied: HTTP 400 `{"error":"access_denied","error_description":"access_denied"}`.
Expired: HTTP 400 `{"error":"expired_token","error_description":"expired_token"}`.
Polling faster than `interval`: HTTP 400 `{"error":"slow_down","error_description":"Poll less frequently.","interval":10}`; increase interval by five seconds each time. Used or unknown device secret: `invalid_grant`.
Approved, first eligible poll only: 200 `{"access_token":"...","token_type":"Bearer","expires_in":900,"refresh_token":"...","refresh_expires_in":2592000,"scope":"account:read"}`.

### POST `/device/token` — refresh
Request: `{"grant_type":"refresh_token","client_id":"finalform-linux","refresh_token":"..."}`.
Response: same token response as successful polling. Refresh is single-use rotation; the old grant and access tokens are invalidated atomically. Missing, expired, reused or revoked: HTTP 400 `invalid_grant`. Store each new refresh token in Secret Service **before** discarding the old one; if the OS secret store write fails, treat the session as disconnected.

### GET `/device/me`
Header: `Authorization: Bearer <access_token>`.
Response 200: `{"user":{"id":"uuid","email":"player@example.com","display_name":"Player","email_verified":true}}`. Expired/revoked/invalid tokens return HTTP 401 `invalid_token`.

### POST `/device/revoke`
Request: `{"token":"<access_or_refresh_token>"}`.
Response 200: `{"revoked":true}` (also for an already invalid token). Revokes the associated grant and its tokens; launcher should delete its saved OS credential afterward. Do not expose this endpoint as a third-party cross-origin request mechanism.

## Browser account endpoints

Browser session cookie: `ff_session`, 7 days, HttpOnly, SameSite=Strict and Secure on HTTPS production. CSRF token returned at login/register and `/account/me`; browser must include `X-CSRF-Token` for account/settings/device decisions and logout/revocation. Cross-origin browser requests are rejected.

| Method | Path | Request | Response |
|---|---|---|---|
| POST | `/account/register` | `{email,display_name,password}` | 201 `{user,csrf_token,email_verification_required:false}` and cookie, or 201 `{user,email_verification_required:true}` without cookie |
| POST | `/account/login` | `{email,password}` | 200 `{user,csrf_token}` and cookie |
| POST | `/account/logout` | `{}` plus CSRF | 200 `{signed_out:true}` and expired cookie |
| GET | `/account/me` | session cookie | 200 `{user,csrf_token}` |
| POST | `/account/settings` | `{display_name}` plus CSRF | 200 `{user}` |
| POST | `/account/verify-email` | `{token}` | 200 `{verified:true}` |
| GET | `/account/devices` | cookie | 200 `{devices:[{id,created_at,expires_at,revoked_at}]}` |
| POST | `/account/devices/:id/revoke` | `{}` plus CSRF | 200 `{revoked:true}` |
| POST | `/device/decision` | `{user_code:"ABCD-EFGH",decision:"approve"\|"deny"}` plus cookie and CSRF | 200 `{status:"approved"\|"denied"}` |

Site verification screen: `GET /verify?user_code=ABCD-EFGH` (browser account sign-in and confirmation). `device_code`, refresh tokens, and access tokens never appear in browser responses or URLs. Error objects use `{"error":"machine_code","error_description":"human-readable"}`. Account errors include `invalid_email`/`invalid_password`/`invalid_display_name` (400), `email_in_use` (409), `invalid_credentials` (401), `email_unverified` (403), `unauthorized` (401), `invalid_csrf`/`invalid_origin` (403), `too_many_attempts` (429), `invalid_user_code` (400), `code_already_used` (409), and `expired_token` (400). All device timestamps are Unix epoch milliseconds in browser settings; relative token expirations are in seconds.

## Required integration sequencing

1. In Electron main, call `/device/authorize`. Keep `device_code` private. Send only user code, URL, expiry and polling interval to React over a purpose-built preload method.
2. Poll `/device/token` on server-prescribed cadence, respecting `slow_down`, 10-minute expiry and network failures. Do not use high-frequency polling.
3. Browser user logs in (or registers), opens `/verify`, checks the matching short code and explicitly approves. Approval is bound to the browser's account and the server-stored authorization.
4. On approval, persist the refresh token via Linux Secret Service, keep short-lived access token in the main process only, call `/device/me`, then signal linked status to the renderer without secrets.
5. Refresh with the stored refresh token when access expires and replace it in the OS store. On sign-out, revoke and remove the stored refresh token. The main process owns all token lifecycle decisions; React does not call these APIs with secrets.
