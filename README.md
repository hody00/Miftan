# מפתן · Miftan

Hebrew RTL property search for Israel. Two application services—Next.js web and Python/Playwright crawler—with PostgreSQL and persistent Docker volumes. Built fresh; independent of POC.

## Start on Windows

Prerequisites: Docker Desktop with Linux containers; Node.js 24 for development and tests.

```powershell
node scripts/init-env.mjs
docker compose up -d --build
```

Website: **http://localhost:3000**. Admin: **http://localhost:3000/admin**. The initializer preserves existing `.env` files; otherwise it generates unique database and admin passwords. Read `ADMIN_EMAIL` and `ADMIN_PASSWORD` locally from `.env`. Never commit credentials. The admin password must contain at least 16 characters. Bootstrap inserts the admin only once: changing `.env` does not reset an existing password.

Production starts with **no sample listings**. Search, favorites, details, and administration operate on persisted records. Favorites stay in the current browser, up to 100 saved IDs. Removed or expired listings disappear from favorites.

## Connect Facebook

1. Sign into the Miftan admin dashboard.
2. Click **פתיחת חלון התחברות**. Open the local window link, sign into Facebook, and complete any verification yourself.
3. Click **סיימתי להתחבר — חזרה לאיסוף**. The recovery window otherwise closes after ten minutes. Collection pauses during recovery.
4. Click **גילוי קבוצות**. Discovered groups are disabled by default. Alternatively add a numerical Facebook group URL manually.
5. Approve only sources whose property content you may publish publicly. Membership alone is not publication approval.
6. Click **סנכרון כעת**, or wait for the scheduled run. Review ambiguous listings in **מודעות**.

For automatic normal login, set `FACEBOOK_EMAIL` and `FACEBOOK_PASSWORD` in `.env`, then run `docker compose up -d crawler`. These credentials never enter the web container. The crawler reuses its private browser-profile volume and pauses on verification challenges. It does not bypass them. A database advisory lock prevents two collectors from using the same profile concurrently.

The collector supports Hebrew and English absolute timestamp tooltips. The rendered UI may change or restrict access. Adapter failures are visible in administration. Posts without stable IDs or absolute publication dates are quarantined.

## Data behavior

- Collection defaults to every 30 minutes, with a configurable minimum of five minutes. Passes revisit only the last 72 hours, bounded by `MAX_SCROLLS` (default 1000). Ten consecutive older posts in chronological order mark the three-day cutoff; a stalled feed or scroll limit reports partial collection. Facebook may not expose every historical post.
- Identical text (ignoring whitespace, direction marks and case) groups cross-posts, including short ads, while preserving original source links. Contact details remain part of the private fingerprint to avoid merging different ads after redaction. Price/room similarity alone never merges listings.
- Hebrew rules extract rental/sale, supported Israeli cities, neighborhood, ILS price, rooms, area, and explicit amenities. Unsupported fields stay null. The city vocabulary lives in `crawler/parser.py`. No external AI or geocoding service is required.
- Property posts publish automatically from approved sources only when at least three categories are known: rent/sale, positive price, positive rooms OR area (one category), and city. Other posts go to review. Every public endpoint also enforces this rule and the rolling three-day window. Cards and detail galleries use photos collected from the original posts. Admin corrections and publication decisions survive later collection.
- Public bodies redact common phone, email, and URL formats. Author profiles and comments are not collected. Original text remains private in PostgreSQL. Redaction cannot recognize every unusual contact format; admins can hide listings and process removal requests.
- Listings expire after 30 days without a meaningful edit or admin renewal. Public queries enforce expiry even when the worker is offline. Cleanup physically removes source content and associated images older than six calendar months. Failed file deletion retains metadata for retry; orphan files have a one-hour grace period.
- Media accepts only HTTPS Facebook CDN hosts without redirects, limits bytes/pixels, and re-encodes to WebP without source metadata. Temporary CDN URLs are never served to visitors.

## Architecture and interfaces

| Service | Responsibility |
| --- | --- |
| web | Public pages/APIs, admin sessions, source approval, corrections, removal requests, migrations |
| crawler | Persistent Chromium, discovery, scheduled jobs, extraction, images, lifecycle cleanup |
| db | PostgreSQL records, job leases, sessions, run history |

Volumes: `database`, `images`, `browser`. Website binds `127.0.0.1:3000`. Recovery binds `127.0.0.1:6080`, and its viewer process runs only during a requested recovery window. Recovery is for the trusted local PC only; never proxy it publicly. PostgreSQL has no host port.

Public endpoints: `GET /api/listings`, `GET /api/listings/:id`, `GET /api/locations`, `GET /api/media/:id`, `GET /api/health`, `POST /api/removals`.

Search parameters: `city`, `neighborhood`, `kind=rent|sale`, `q`, `min`, `max`, `rooms`, `days`, `sort=newest|price_asc|price_desc`, `page`, and a bounded comma-separated UUID `ids` list. Pages contain 18 records. Public queries require an approved source and an unexpired published listing.

`POST /api/auth` and `DELETE /api/auth` manage sessions. `GET /api/admin` returns operations state. `POST /api/admin` accepts validated source, approval, job, listing, removal, and resume actions. Mutations require the configured `APP_URL` origin. Sessions use hashed random tokens, HttpOnly SameSite=Strict cookies, 12-hour expiry, and Secure cookies under HTTPS. Passwords use salted scrypt; login attempts are throttled. JSON bodies are capped at 16 KiB. Use the canonical hostname consistently: `localhost` and `127.0.0.1` are different origins.

## Operations

```powershell
docker compose ps
docker compose logs --tail 100 web crawler
docker compose restart crawler
docker compose stop
docker compose up -d
```

Restart policies recover services when Docker starts. Enable Docker Desktop startup through your Windows setup and keep the PC awake for scheduled collection. Health checks report failures; Docker health status alone does not restart a container. Process failures restart, the worker retries database connections, and the dashboard identifies stale heartbeats.

Before upgrades, back up, then run `docker compose up -d --build`. Web startup applies versioned SQL migrations transactionally under an advisory lock. Keep migrations compatible with the running crawler during upgrades. Do not use `docker compose down -v` unless you intend to erase persisted data.

### Backup and restore

```powershell
./scripts/backup.ps1
./scripts/restore.ps1 -DatabaseDump ./backups/TIMESTAMP.dump -ImageArchive ./backups/TIMESTAMP-images.tar.gz -ConfirmReplace
```

Backup pauses the crawler, dumps PostgreSQL, archives images, then restarts collection. Restore stops applications, replaces database contents, restores images, and restarts only after success. Browser sessions and `.env` are excluded: protect credentials separately and sign into Facebook again when migrating machines. Keep encrypted off-machine copies and an appropriate backup retention policy; cleanup does not rewrite old backups. Verify restoration into a disposable database.

### Future public deployment

Use a maintained host and HTTPS reverse proxy/tunnel. Set `APP_URL` to the exact HTTPS origin. Proxy only web port 3000; preserve database and recovery isolation. Use SSH forwarding for recovery. Configure request limits, monitoring, and private backups before exposing the service. This delivery intentionally opens no public tunnel or firewall port.

## Development and tests

```powershell
npm ci
npm run typecheck
npm test
npm run build
```

Docker is the supported default runtime. Direct `npm run dev` requires PostgreSQL environment variables for a separate reachable development database; Compose's database is intentionally not exposed to Windows.

Integration/browser tests use an isolated `miftan_test` database and `test-images` volume. Test scripts refuse to seed or truncate the real database.

```powershell
docker compose exec -T db createdb -U miftan miftan_test
docker compose -f compose.yaml -f compose.test.yaml --profile test up -d test-web
docker compose -f compose.yaml -f compose.test.yaml --profile test run --rm --no-deps test-crawler
docker compose -f compose.yaml -f compose.test.yaml --profile test run --rm --no-deps test-crawler python seed_test.py
npx playwright install chromium
npm run test:e2e
docker compose -f compose.yaml -f compose.test.yaml --profile test stop test-web
```

Skip `createdb` when the test database exists. Rebuild application images after changes. Browser tests default to localhost:3001 and read admin credentials from `.env` without printing them. Keep traces private: `test-results` and `playwright-report` are untracked because failures may capture credential entry.

Tests cover extraction, unknown values, redaction, identities/dates, approval, deduplication, corrections, expiry, image validation/cleanup, job leases, parameterized search, responsive RTL, details, favorites, admin login/edit/logout, and unauthorized requests. Live ingestion remains a separate acceptance check requiring Facebook access and an approved source.
