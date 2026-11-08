# l3gh gallery backend

Isolated Flask/Gunicorn service, loopback 127.0.0.1:7100. Public hosting stays on Vercel. Source contains no credentials or content. Python 3.13; create .venv, pip install -r requirements.lock. Run `.venv/bin/pytest -q`.

## Configuration and launch

Private /etc/l3gh-media.env (root 0600), generated SESSION_SECRET, PUBLIC_ORIGIN=https://media.l3gh.com, DATA=/var/lib/l3gh-media. GITHUB_OWNER_IDS=228398289 resolves public GitHub l3gh identity on 2026-11-08. Only numeric IDs authorize. Missing owner, client ID, client secret or session secret returns setup unavailable for all admin routes. No bypass exists. Credentials must enter through a private file, never source or CLI arguments.

Register a dedicated OAuth App: https://github.com/settings/applications/new ; homepage https://media.l3gh.com/admin ; callback https://media.l3gh.com/auth/github/callback. No repository or email scope needed. Restart service after configuring. GitHub state + S256 verifier stored server-side for ten minutes, consumed once even on failed callback. Access token used only for GET /user, never persisted. Sessions expire after eight hours and rotate on login. Cookie is __Host-gallery, Secure HttpOnly SameSite=Lax, host-only path /. Session secret hashes opaque session identifiers in SQLite. Logout revokes server session.

Systemd service installed, active and enabled at boot. One synchronous worker bounds image concurrency; 1200M memory limit; 650s worker deadline. Admin forms require same-origin Origin and session CSRF. Login 10/10min and upload 20/hour limits persist in DB; behind Caddy they share its loopback peer bucket, deliberately do not trust arbitrary forwarded headers. This is suitable for one owner, not multiuser traffic.

DNS media A 88.218.227.20 was added via Spaceship with automatic private backup. Caddy now routes media.l3gh.com to loopback 7100 with automatic HTTPS; watch.l3gh.com remains on loopback 7000 with its existing dial 5s / response-header 15s proxy deadlines. No Vercel changes were made. Caddy 2.6.2 only offers server-wide body/write deadlines: the shared listener now has finite read_body 600s / write 660s limits, retaining header 10s / idle 30s. This allows a 20MiB upload at roughly 35KiB/s; media proxy write limit 600s, response header 650s, response read 60s, application worker 650s. The longer shared body/write caps also apply to watch connections; watch routing and upstream response deadline are preserved. A future Caddy upgrade can offer more granular timeout controls. Caddy request limit is exactly 21MiB, matching Flask. Never alias the data directory or enable callback URL logging.

Activation rollback: original Caddyfile and service unit are private in /root/l3gh-activation-20261108T183754. Restore Caddyfile, validate it, and reload caddy if reverting routing. Credentials are root-only /etc/l3gh-media.env 0600 and private input files were removed. OAuth redirect now uses the exact /auth/github/callback path. Real GitHub login still requires the owner to open https://media.l3gh.com/admin and authorize in their browser. Public-site launch remains pending offhost backup selection; no offhost protection exists.

## Data and public contract

Upload JPEG/PNG/WebP only, single frame, at most 20MiB file (21MiB multipart request), 40 million pixels with Pillow bomb warnings treated as errors. Decoder verifies then loads, EXIF orientation corrected. UUID hex filenames. Originals remain private, derivative WebP display <=2560px and thumbnail <=480px strip metadata; stored width/height describe display. Draft/edit/publish/unpublish/order/delete forms at /admin. No automatic content migration.

GET /api/gallery is exactly {items:[{id,title,caption,alt,image_url,thumbnail_url,width,height}]}, published only, position then ID ordering. Paths are /media/<uuid>-display.webp and -thumb.webp. Media checks publication on every request; originals and draft derivatives have no route. Responses revalidate immediately (max-age=0,must-revalidate); already downloaded/cached copies cannot be recalled. CORS read allowlist only https://l3gh.com and https://www.l3gh.com, no credential support. Admin has no CORS. CSP and escaped templates constrain content.

1GiB quota (reduced for seven local full archives on this 20GiB VPS) and 1GiB disk reserve plus 64MiB upload margin; tune constants in config for other deployments. Failed uploads remove partial files including failed DB inserts. Delete commits DB removal before unlink so failures cannot expose deleted media. A crash or unlink failure may leave private orphan files: while service stopped compare UUID files with DB IDs and remove only confirmed orphans; no public leak. Generic errors only; Gunicorn access logging disabled to avoid callback query logging. Do not enable request URL logging at proxy. /health reports DB-readable process health, not OAuth readiness.

## Backups and restore

backup.py uses SQLite online backup API and shared flock against image mutations to create a coordinated DB + originals + derivatives gzip archive. Session and rate-limit rows removed from snapshot. Run as l3gh-media with restrictive umask; /var/backups/l3gh-media is 0700, archives 0600. Last seven archives retained. Daily timer/service are installed and enabled; initial backup succeeded. Local backups only: disk loss loses both live data and archives. No offhost protection exists yet. Root-only env secret backup/rotation is a separate administrator responsibility.

Run `sudo -u l3gh-media /opt/l3gh-media/.venv/bin/python /opt/l3gh-media/backup.py`. Restore: stop l3gh-media, preserve current data, extract a trusted archive into an empty private staging directory using Python tarfile filter='data', run PRAGMA integrity_check and verify every DB ID has original/display/thumb files, clear sessions, then replace data under same service ownership 0700 and restart. Never extract untrusted archives. Tests restore into isolated temporary directories and verify DB rows and original files. Seven full archives are retained. The 1GiB gallery quota reserves capacity for these on this VPS; monitor free disk as other services grow. Failed timer runs are visible via systemctl status l3gh-media-backup.service. Local archives share the live disk and do not protect against disk/VPS loss.

Official implementation references: https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps ; https://flask.palletsprojects.com/en/stable/web-security/ ; https://pillow.readthedocs.io/en/stable/reference/Image.html ; https://docs.python.org/3/library/sqlite3.html#sqlite3.Connection.backup . Requirements lock pins all runtime and test dependencies. Re-evaluate updates before public launch.


Activation checks (2026-11-08): six pytest tests pass, including owner rejection, callback replay/mismatch denial, publication lifecycle, restore, and failed-upload cleanup. Public HTTPS health and empty gallery API passed. Redirect includes state/S256 PKCE and exact callback, with secure host-only cookie and no secret URL fields. A synthetic local owner session (not real GitHub login) accepted a 20MiB upload over 41.1 seconds; its draft stayed private and all test files/rows/session were removed. watch homepage remained HTTP 200. Caddy validation and systemd unit verification passed. Owner must still test GitHub consent, return to admin, upload/publish/unpublish/logout in a browser. No offhost backup is configured.

Admin diagnostic follow-up (2026-11-08): accept both /admin and /admin/; the authenticated trailing-slash route previously returned 404, reproduced in an isolated mocked-OAuth regression test before the fix. Eight tests now pass, adding cookie attributes, missing/expired OAuth state, numeric owner ID 228398289, admin form actions/CSP, slash routing and logout revocation coverage. These tests use temporary data and mocked GitHub responses, and do not prove the real GitHub flow. Deployed origin and owner allowlist matched the expected values; HTTPS health and unsigned login redirects passed with the exact callback URI. Recent service journal had no exception/error markers. Access logs are disabled for privacy, so real user response statuses cannot be established from these logs. No actual browser screenshots or authenticated GitHub browser verification were obtained. If failure persists, obtain the failing step, URL path without query, displayed error/status and approximate UTC time; never collect callback query parameters or cookies.

Upload 403 investigation (2026-11-08): confirmed browser form bug: global
`Referrer-Policy: no-referrer` causes Chromium navigation form POSTs to send
`Origin: null`; strict origin validation rejects the upload before CSRF parsing.
Admin responses now use `same-origin`; callback and public responses retain
`no-referrer` so OAuth query parameters cannot leak via a callback referrer.
Origin allowlist and session-bound CSRF remain mandatory. Reload an already-open
admin tab after deployment so it receives the new response policy.

21 pytest regressions pass. Optional `browser_regression.py` uses Playwright
Chromium, intercepted HTTPS, temporary storage, a generated PNG and mocked GitHub
OAuth exchange (no production authentication or data). It reads the hidden token
from the rendered multipart form through an actual browser submission, verifies
cookie transmission, reproduces old-policy 403/Origin null, then verifies the new
policy accepts a private draft. Install playwright and its Chromium in a separate
test environment to run it; it is not a service dependency.

Safe structured journal events contain route path templates (never query strings),
operation, fixed reason enum and response status. Mutation 403 reasons are
`origin_rejected` and `csrf_rejected`. Callback 403 reasons are
`session_missing_or_expired`, `state_consumed`, `state_expired`, `state_mismatch`,
`authorization_declined`, `code_missing`, `owner_rejected`. Malformed GitHub
identity/token responses and exchange failures return helpful 502 responses;
provider text and exception details are never logged. A successful mocked or real
callback records `authenticated`; tests never target production data. For any
remaining failure only the URL path and failing step are needed to find the safe
reason; never collect cookies or callback queries.

Public API owner ID was rechecked as 228398289. Session IDs use SQLite TEXT
and validated GitHub numeric IDs are explicitly converted to strings before
storage. Callback does not require Origin/Referer or mutation CSRF; it requires a
live eight-hour session and one-use ten-minute state/PKCE verifier. Repeating login
in another tab replaces the cookie/session and invalidates the earlier flow.
Secure host-only SameSite=Lax cookies support the top-level GitHub GET callback.
No application URL derives from proxy Host/scheme: the configured HTTPS origin
fixes the callback and origin check; Secure cookies are unconditional. Caddy
terminates TLS and proxies to loopback, and Gunicorn trusts loopback secure scheme
headers by default. No ProxyFix or forwarded-IP trust is needed. Authenticated GET,
HEAD and OPTIONS are exempt from mutation CSRF; POSTs remain protected. Public
Vercel hosting and gallery routes/data are unchanged. Real owner upload retry is
still needed to verify the live user session.
