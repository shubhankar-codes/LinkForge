const cache      = require('../lib/cache');
const UrlModel   = require('../models/url');
const ClickModel = require('../models/click');
const { createError }    = require('../middleware/errorHandler');
const { parseUserAgent, hashIp, getClientIp, getReferrer } = require('../utils/parseRequest');

// GET /:slug
// The hottest path in the entire app — optimise every line here.
async function redirect(req, res, next) {
  try {
    const { slug } = req.params;

    // ── 1. Check Redis cache first ────────────────────────────
    // Cache key pattern: "slug:<value>" — namespaced to avoid collisions
    const cacheKey = `slug:${slug}`;
    const cached   = await cache.get(cacheKey);

    let longUrl;

    if (cached) {
      // Cache HIT — fastest possible path, no DB query at all
      longUrl = cached;
    } else {
      // Cache MISS — hit the DB
      const record = await UrlModel.findBySlug(slug);

      // Slug doesn't exist in DB
      if (!record) {
        throw createError(404, `Short link "${slug}" not found`);
      }

      // Check expiry — if set and in the past, the link is dead
      if (record.expires_at && new Date(record.expires_at) < new Date()) {
        throw createError(410, `Short link "${slug}" has expired`);
      }

      longUrl = record.long_url;

      // Store in Redis so next request is a cache hit
      // TTL: 1 hour (3600s) — balances freshness vs speed
      await cache.set(cacheKey, longUrl, 3600);
    }

    // ── 2. Send the redirect immediately ─────────────────────
    // User is done — browser follows Location header right away.
    // Everything below this line runs AFTER the user is gone.
    res.redirect(302, longUrl);

    // ── 3. Log the click asynchronously ──────────────────────
    // We intentionally do NOT await this — it runs in the background.
    // If it fails, the redirect already succeeded — user unaffected.
    logClickAsync(req, slug).catch(err =>
      console.error('Click log failed (non-fatal):', err.message)
    );

  } catch (err) {
    next(err);
  }
}

// ── logClickAsync ─────────────────────────────────────────────
// Runs after redirect is sent. Fetches the url record (for its id),
// parses request metadata, and inserts a click row.
async function logClickAsync(req, slug) {
  // Need the url id — re-fetch from DB (cache only stores long_url)
  const record = await UrlModel.findBySlug(slug);
  if (!record) return; // race condition guard

  const ip  = getClientIp(req);
  const ua  = req.headers['user-agent'];
  const ref = getReferrer(req);

  const { device, browser } = parseUserAgent(ua);

  // Fire both writes concurrently — they don't depend on each other
  await Promise.all([
    ClickModel.logClick({
      urlId:    record.id,
      country:  null,        // geolocation added on Day 9
      device,
      browser,
      referrer: ref,
      ipHash:   hashIp(ip),
    }),
    UrlModel.incrementClickCount(record.id),
  ]);
}

module.exports = { redirect };