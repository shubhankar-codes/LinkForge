# LinkForge

Shorten links, understand visits, and control destinations. A complete Express + PostgreSQL application with a responsive dashboard served by the same process. No frontend build step is required.

## Run locally

Requires Node.js 22+, PostgreSQL 15+, and optionally Redis 7+.

```sh
npm install
cp .env.example .env
# Edit .env for your database, public BASE_URL, and random JWT_SECRET / ANALYTICS_SALT.
createdb linkforge
npm run db:migrate
npm start
```

Open http://localhost:3000. If that port is occupied, set both `PORT` and `BASE_URL`, for example:

```sh
PORT=3087 BASE_URL=http://localhost:3087 npm start
```

Do not overwrite an existing `.env`. `createdb` is only needed for a new database. `db:migrate` creates the initial schema only when absent and applies additive, repeatable migrations; it does not drop existing tables or seed accounts. Development can generate a temporary signing secret, but sessions then expire on restart. Production requires a persistent `JWT_SECRET`.

## Features

- Public URL shortening with custom slugs, transactional ID/base62 allocation, reserved-name validation, and duplicate handling.
- Register/sign in, account-owned link lists, search, destination editing, deletion, and QR codes.
- Date expiry and atomic click limits, enforced even under concurrent requests. HEAD requests do not consume clicks.
- Password-protected links with bcrypt, rate-limited unlock attempts, and short-lived HttpOnly cookies. Changing the password invalidates existing unlock cookies.
- Ordered device/country redirect rules; first matching rule wins, with the original URL as fallback.
- Owner-only analytics: lifetime clicks, UTC daily/hourly patterns, country, device, browser, referrer, and destination UTM campaign/source/medium breakdowns. No fabricated dashboard data.
- Editable link-in-bio pages with ordered links, served at `/b/:username`.
- Custom Open Graph title, description, image, and explicit share pages at `/preview/:slug`. Share that preview URL for custom social cards; regular short links redirect immediately. Protected links do not expose custom previews.
- Redis-backed QR image caching when `REDIS_URL` is set; Redis failure is nonfatal. Redirects deliberately consult PostgreSQL so gates, edits, expiry, deletion, and click caps remain authoritative.
- Security headers, bounded request bodies, per-IP rate limits, ownership checks, and escaped public HTML.

Anonymous links are public and cannot be managed later. Sign in before creating links to associate them with your account. Sessions are stored in browser session storage. There is no email verification, password-reset mail flow, or email-capture gate in this version.

Geo lookup uses `https://ipwho.is` for public client IPs, with a timeout and bounded in-process cache. This sends the visitor IP to the provider; local/private IPs are skipped. Country routing falls back to the original URL on lookup failure. Only salted daily IP hashes are stored in click records. Referrers are the single referrer header browsers provide, not full navigation chains. UTMs are read from the saved destination. Asynchronous analytics are best effort: the atomic redirect count is authoritative, and a process crash can lose a detailed click event. Configure `TRUST_PROXY` only to match a trusted reverse proxy; raw forwarding headers do not override Express's client IP in live requests.

## API

All request/response bodies are JSON except redirects, public HTML, and QR PNGs. Send `Authorization: Bearer <token>` for owner endpoints.

- `POST /api/auth/register`, `POST /api/auth/login`: `{ "email": "you@example.com", "password": "at-least-8-characters" }`; returns token and user. `/auth/register` and `/auth/login` are aliases.
- `POST /api/shorten`: `{ "url": "https://example.com", "custom_slug": "my-link", "expires_at": "2030-01-01T00:00:00Z", "max_clicks": 100, "password": "optional-secret", "rules": [{ "type": "device", "match": "mobile", "destination": "https://m.example.com" }], "og_title": "Preview title", "og_description": "Preview description", "og_image": "https://example.com/image.jpg" }`. Only `url` is required. Country rules use uppercase ISO alpha-2 matches; device matches are `mobile`, `tablet`, or `desktop`.
- `GET /api/links`: owner links.
- `PUT /api/links/:slug`: update destination/settings. Omitted settings are preserved; empty password removes protection. Slugs are immutable.
- `DELETE /api/links/:slug`: delete an owned link and its click history.
- `GET /api/stats/:slug?days=30`: owner analytics, 1–90 days.
- `GET /api/qr/:slug`: 512px PNG of the short URL.
- `GET /api/bio`: own bio pages and links.
- `POST /api/bio`: create/update an owned username with `{ "username": "your-name", "title": "Your name", "bio": "About you", "links": [{ "label": "Website", "url": "https://example.com" }] }`. Array order defines display order.
- `GET /api/health`: database readiness; `GET /api/cache/stats`: authenticated cache metrics.
- `GET /:slug`: redirect or password gate; `POST /:slug`: password unlock.
- `GET /b/:username`, `GET /preview/:slug`: public pages.

## Validation

```sh
npm run lint
npm test -- --runInBand
npm run test:integration
```

The integration suite uses the configured local database and an ephemeral HTTP port. It creates uniquely named test accounts, verifies core API flows and simultaneous click-limit enforcement, then removes its own data. Run it against a development database. Unit tests do not require PostgreSQL or Redis.

## Docker and deployment

Set long random `JWT_SECRET`, `ANALYTICS_SALT`, and a database password in `.env`, then:

```sh
docker compose up --build
```

PostgreSQL data lives in a named volume. The app waits for database health, applies migrations, and starts on port 3000. The Docker image uses Node 22 and a non-root runtime user. For an external host, provision PostgreSQL, set `DATABASE_URL` (or the `DB_*` variables), `BASE_URL`, `JWT_SECRET`, and `ANALYTICS_SALT`; run migrations before starting. Put HTTPS in front of production and configure trusted proxies explicitly. Public cloud hosting has not been provisioned by this repository.

Production rate limits are per process. A multi-instance installation should use a shared rate-limit store. Add durable analytics delivery, abuse/moderation controls, account recovery, backups, and production monitoring before operating a public service at scale. No sub-millisecond latency or load capacity claim has been benchmarked.
