# Deploy LinkForge on Render + Neon

The repository's `render.yaml` creates one Docker web service on Render. PostgreSQL stays in Neon; Redis is optional and is not required for this deployment.

## 1. Create the database in Neon

1. Create a project at https://console.neon.tech. Choose a region near your Render service.
2. Open **Connect**, choose the intended branch, database, and role.
3. Enable connection pooling and copy the pooled PostgreSQL URL for `DATABASE_URL` (hostname contains `-pooler`).
4. Disable connection pooling and copy the direct URL for `DATABASE_URL_UNPOOLED` (hostname does not contain `-pooler`).
5. Keep the supplied TLS parameters such as `sslmode=require&channel_binding=require`. Paste URL values without surrounding quotes. Do not commit either URL.

The app uses `pg` with channel binding enabled and a small five-connection pool. A 15-second connection timeout allows for database wake-up. Migrations use the direct URL because their advisory lock requires a persistent database session.

## 2. Create a Render Blueprint

1. Sign in at https://dashboard.render.com and select **New → Blueprint**.
2. Connect `shubhankar-codes/LinkForge` and select branch `main` and `render.yaml`.
3. When prompted, paste the pooled Neon URL into `DATABASE_URL` and the direct Neon URL into `DATABASE_URL_UNPOOLED`.
4. Review the service plan and region, then create/deploy the Blueprint.

The Blueprint selects the free plan as a starting point. Availability and quotas depend on your account. Use a paid always-on instance for dependable public redirects; a sleeping app can delay the first visitor.

Render generates `JWT_SECRET` and `ANALYTICS_SALT` when those variables do not already exist. They live in the service environment and are reused on redeploys. They are not generated during application startup. Keep them stable; changing `JWT_SECRET` invalidates sessions and password-unlock cookies. Save a secure copy if you later recreate the service. For an existing deployment, preserve your existing production secrets.

## 3. What happens during deployment

- Render builds the existing Dockerfile using Node 22 and installs production dependencies.
- The Dockerfile runs `node scripts/migrate.js && exec node src/app.js`.
- Migrations take a database advisory lock, create the schema if absent, and apply repeatable additive migrations. A failure stops startup. Existing records are preserved.
- `/api/health` checks database connectivity and the presence of the `urls` table.
- The app uses Render's supplied `PORT` and `RENDER_EXTERNAL_URL`. Short links, QR images, bio links and preview URLs use the deployed HTTPS address automatically.
- `TRUST_PROXY=1` is configured for the Render reverse proxy; revisit the setting if you add another proxy layer.

No custom build command, Render database, Redis instance, or production `.env` file is needed. The migrations run on startup so this works without a paid pre-deploy feature. This setup assumes additive migrations compatible with the running app. For larger deployments, move migrations into a controlled release step before scaling.

## 4. Verify

1. Open `https://YOUR-SERVICE.onrender.com/api/health`; expect `{"status":"ok"}`.
2. Register an account, shorten a URL, and verify that the short URL uses your Render hostname.
3. Open it from another device. Check Stats, QR, bio pages, and password-gated links.
4. Redeploy and confirm that the account and links still exist in Neon.

A new Neon database starts empty. Local accounts and links are not automatically transferred.

## Custom domain

Add your domain in Render and complete the required DNS configuration. Set `BASE_URL=https://links.yourdomain.com` in the app's Render environment, without a trailing slash. Redeploy. Keep `BASE_URL` unset when using only the default Render hostname. Do not set it to localhost in production.

## Manual web-service alternative

If using **New → Web Service** rather than a Blueprint, select Docker and set:

- Leave Docker Command empty so Render uses the Dockerfile default, which runs migrations before starting the app.
- Health check: `/api/health`
- Environment: `NODE_ENV=production`, `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `JWT_SECRET`, `ANALYTICS_SALT`, and `TRUST_PROXY=1`.

Generate two separate secret values locally with `openssl rand -hex 32`, and save one as `JWT_SECRET` and the other as `ANALYTICS_SALT` in Render. Never paste secrets into GitHub issues or source files.

## Troubleshooting

- Migration connection/schema error: check both URL values, database role privileges, Neon branch status, and TLS parameters. Use a direct URL for migrations.
- Short links say localhost: remove the production `BASE_URL` override or replace it with the public HTTPS domain.
- Sessions reset on each deploy: retain a stable Render `JWT_SECRET` instead of replacing it.
- Health check fails: inspect Render deploy logs and verify Neon is reachable. Do not publish credentials from logs.

References: https://render.com/docs/blueprint-spec, https://render.com/docs/environment-variables, https://neon.com/docs/connect/connection-pooling.
