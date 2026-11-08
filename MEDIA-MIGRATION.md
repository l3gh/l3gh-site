# Media and admin migration

Status: backend activated on VPS; real user login and upload verification pending. Existing gallery and Vercel routes are unchanged. No existing content has been migrated. User confirmed `media.l3gh.com`, GitHub owner `l3gh` (numeric ID `228398289`), and local backups first; off-host storage must be selected before public-site launch.

## Deployment contract

- Public HTML remains on Vercel.
- Backend origin: `https://media.l3gh.com` (DNS record and TLS active). Windows resolver still returned NXDOMAIN during verification; requests pinned to the authorized server IP with normal TLS certificate validation succeeded.
- `/admin` on the backend owns GitHub login, same-origin sessions and CSRF-protected mutations. Add a Vercel redirect from `/admin` only after authentication is verified.
- OAuth callback: `https://media.l3gh.com/auth/github/callback`.
- Authorized identity: numeric GitHub user ID, resolved from the user's confirmed login, never an unrestricted GitHub sign-in.
- API: `GET /api/gallery` returns `{ "items": [...] }` with only published entries in display order. Each item contains `id`, `title`, `caption`, `alt`, `image_url`, `thumbnail_url`, `width`, `height`. Media paths begin `/media/`, relative to the backend origin or absolute on that origin.
- Allow public read CORS for `https://l3gh.com` and `https://www.l3gh.com`; no credentialed cross-origin admin requests. No broad Vercel preview wildcard.
- Private originals and drafts must never be exposed by a static directory route. Media access checks publication state. Published derivatives should have short revalidation caching so unpublishing takes effect. Previously downloaded images cannot be recalled.

## Staging

The new client is `/gallery/next/`. It fetches the VPS API directly, displays published content, and provides a keyboard-accessible image dialog. It shows an honest unavailable state until the backend is ready. This is functional scaffolding; the final gallery visual design remains open.

## Launch gates

1. Confirm hostname and GitHub owner. Provision DNS and valid TLS without changing unrelated applications.
2. Register a GitHub OAuth app. Homepage: `https://l3gh.com`; callback as above. Enter credentials privately, not in Git or chat.
3. Verify login denial for other accounts, expired sessions, invalid OAuth state/PKCE, CSRF denial, and logout.
4. Test validated uploads, thumbnails, captions, order, draft privacy, publishing/unpublishing, deletion and orphan-file cleanup.
5. Configure consistent SQLite-and-file backups, an off-host destination, retention and a tested restore. Local archives alone do not protect against VPS loss.
6. Test the actual Vercel-to-VPS request, real GitHub login and one real upload before switching the gallery.
7. Migrate selected images; verify the site no longer references them before removing the old copies from Git. Removing current files does not remove them from Git history.

## Server layout

Proposed code `/opt/l3gh-media`; service user `l3gh-media`; private data `/var/lib/l3gh-media`; secrets `/etc/l3gh-media.env`; localhost bind `127.0.0.1:7100`; Caddy TLS proxy. Keep originals outside web roots. Document upgrades, backups and rollback alongside the backend source.

## Activation verification (2026-11-08)

- Initial activation source commit `b383471`; source archive private at `/root/l3gh-media-source.tar.gz`. Current deployed source `75b00a3e4012e49e56e1b21303e89eca96174d34` is now tracked under `backend/media/`, with provenance in `SOURCE.md` and all 21 backend tests passing on Linux during import. `.vercelignore` excludes it from static deployment.
- Dedicated service and daily local backup timer enabled. Agent reports six passing tests, including media lifecycle and restore, and a successful 20 MiB upload over 41 seconds; test content removed.
- Parent independently verified `/health` returns 200, `/api/gallery` returns `{"items":[]}` and allows the `https://l3gh.com` origin, and unauthenticated `/admin` returns 401 over valid HTTPS using explicit DNS resolution.
- Caddy media route enabled; existing watch route retained. Shared request body/write deadlines increased to 10/11 minutes because installed Caddy supports these at listener level; existing watch upstream deadlines retained.
- Application quota 1 GiB; seven local backup archives budgeted. No off-host backup protection.
- OAuth secrets installed only on VPS. User reached authenticated admin and reported the draft-upload failure subsequently fixed below; their post-fix retry remains pending. Frontend integration with a published item, off-host backups and replacement of the existing public gallery are still pending. Source transfer is complete; the site changes have been pushed while the original gallery remains live.

## Admin route fix (2026-11-08)

Backend commit `66944b4` fixes authenticated `/admin/` returning 404. Both `/admin` and `/admin/` are now covered by regression tests; agent reports eight tests passing. Real browser authentication and upload verification remain pending. No successful authenticated screenshots have been obtained. Request logs are disabled, so recent error-free service logs alone do not prove a real user completed the flow.

## Draft upload fix (2026-11-08)

User confirmed 403 occurs submitting Upload draft. Agent reproduced the failure in Chromium: admin `Referrer-Policy: no-referrer` resulted in `Origin: null` on multipart submission and the strict Origin check rejected it despite valid session/CSRF. Commit `75b00a3` changes the admin policy to `same-origin`, preserving request-origin and CSRF validation. Agent reports browser upload success with the fix and 21 tests passing, plus safe reason-only denial logging. Service restarted, source archive updated, public-site unchanged. Reload the admin page before retrying so the browser receives the new document policy. Actual user retry remains pending.
