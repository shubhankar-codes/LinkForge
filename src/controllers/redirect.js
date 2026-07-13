const cache      = require('../lib/cache');
const UrlModel   = require('../models/url');
const ClickModel = require('../models/click');
const { createError } = require('../middleware/errorHandler');
const { parseUserAgent, hashIp, getClientIp, getReferrer } = require('../utils/parseRequest');

async function redirect(req, res, next) {
  try {
    const { slug } = req.params;
    const start    = Date.now(); // track total time for logging

    // ── 1. Redis first ────────────────────────────────────────
    const cached = await cache.getSlug(slug); // uses namespaced key snap:slug:X

    let longUrl;
    let source; // "cache" or "db" — logged below, useful for debugging

    if (cached) {
      longUrl = cached;
      source  = 'cache';
    } else {
      // ── 2. DB fallback ────────────────────────────────────
      const record = await UrlModel.findBySlug(slug);

      if (!record) throw createError(404, `Short link "${slug}" not found`);

      if (record.expires_at && new Date(record.expires_at) < new Date()) {
        throw createError(410, `Short link "${slug}" has expired`);
      }

      longUrl = record.long_url;
      source  = 'db';

      // ── 3. Warm the cache for next time ───────────────────
      await cache.setSlug(slug, longUrl); // TTL 1hr, key snap:slug:X
    }

    const ms = Date.now() - start;
    console.log(`→ /${slug} [${source}] ${ms}ms`); // you'll see this in terminal!

    // ── 4. Redirect — user is done after this line ────────────
    res.redirect(302, longUrl);

    // ── 5. Background analytics — never awaited ───────────────
    logClickAsync(req, slug).catch(err =>
      console.error('Click log failed (non-fatal):', err.message)
    );

  } catch (err) {
    next(err);
  }
}

async function logClickAsync(req, slug) {
  const record = await UrlModel.findBySlug(slug);
  if (!record) return;

  const { device, browser } = parseUserAgent(req.headers['user-agent']);

  await Promise.all([
    ClickModel.logClick({
      urlId:    record.id,
      country:  null,
      device,
      browser,
      referrer: getReferrer(req),
      ipHash:   hashIp(getClientIp(req)),
    }),
    UrlModel.incrementClickCount(record.id),
  ]);
}

module.exports = { redirect };