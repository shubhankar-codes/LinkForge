const cache            = require('../lib/cache');
const UrlModel         = require('../models/url');
const { trackClick }   = require('../services/analytics');
const { createError }  = require('../middleware/errorHandler');

async function redirect(req, res, next) {
  try {
    const { slug } = req.params;
    const start    = Date.now();

    // ── 1. Cache check ────────────────────────────────────────
    const cached = await cache.getSlug(slug);
    let longUrl, urlRecord, source;

    if (cached) {
      longUrl = cached;
      source  = 'cache';
    } else {
      // ── 2. DB lookup ──────────────────────────────────────
      urlRecord = await UrlModel.findBySlug(slug);

      if (!urlRecord) throw createError(404, `Short link "${slug}" not found`);

      if (urlRecord.expires_at && new Date(urlRecord.expires_at) < new Date()) {
        throw createError(410, `Short link "${slug}" has expired`);
      }

      longUrl = urlRecord.long_url;
      source  = 'db';

      await cache.setSlug(slug, longUrl);
    }

    console.log(`→ /${slug} [${source}] ${Date.now() - start}ms`);

    // ── 3. Redirect — user is done ────────────────────────────
    res.redirect(302, longUrl);

    // ── 4. Analytics — runs fully after redirect sent ─────────
    // We need the full record for the url id — fetch if we only have cache
    if (!urlRecord) urlRecord = await UrlModel.findBySlug(slug);
    if (urlRecord) {
      // No await — truly fire and forget
      trackClick(req, urlRecord).catch(err =>
        console.error('trackClick failed:', err.message)
      );
    }

  } catch (err) {
    next(err);
  }
}

module.exports = { redirect };