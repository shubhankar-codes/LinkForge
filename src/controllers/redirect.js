const cache = require('../lib/cache');
const UrlModel = require('../models/url');
const { trackClick } = require('../services/analytics');
const { createError } = require('../middleware/errorHandler');

async function redirect(req, res, next) {
  try {
    const { slug } = req.params;
    let record = null;
    let cacheHit = false;
    const cached = await cache.getSlug(slug);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (parsed && parsed.id && typeof parsed.long_url === 'string'
            && Object.prototype.hasOwnProperty.call(parsed, 'expires_at')) {
          record = parsed;
          cacheHit = true;
        }
      } catch { /* Old URL-only cache entries are treated as misses. */ }
    }
    if (!record) {
      record = await UrlModel.findBySlug(slug);
      if (!record) throw createError(404, 'Short link not found');
    }
    if (record.expires_at && new Date(record.expires_at).getTime() <= Date.now()) {
      throw createError(410, 'Short link has expired');
    }
    if (!cacheHit) {
      await cache.setSlug(slug, JSON.stringify({
        id: record.id, long_url: record.long_url, expires_at: record.expires_at || null,
      }));
    }
    res.redirect(302, record.long_url);
    trackClick(req, record).catch(err => console.error('trackClick failed:', err.message));
  } catch (err) {
    next(err);
  }
}

module.exports = { redirect };
