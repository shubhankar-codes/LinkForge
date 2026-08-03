const { getCountry }     = require('./geo');
const { parseUserAgent, hashIp, getClientIp, getReferrer } = require('../utils/parseRequest');
const ClickModel         = require('../models/click');
const UrlModel           = require('../models/url');

// ── trackClick(req, urlRecord) ────────────────────────────────
// Called fire-and-forget after res.redirect() is sent.
// Collects all metadata about the click and writes it to DB.
// Any failure here is logged but never crashes the app.
async function trackClick(req, urlRecord) {
  try {
    const ip      = getClientIp(req);
    const ua      = req.headers['user-agent'] || '';
    const ref     = getReferrer(req);

    // Run geo lookup + UA parse concurrently — they don't depend on each other
    const [country, { device, browser }] = await Promise.all([
      getCountry(ip),
      Promise.resolve(parseUserAgent(ua)),
    ]);

    // Write the click row
    await ClickModel.logClick({
      urlId:    urlRecord.id,
      country,                 // "IN", "US", null
      device,                  // "mobile", "desktop", "tablet", "unknown"
      browser,                 // "chrome", "firefox", "safari", "edge", "other"
      referrer: ref,           // "https://twitter.com" or null
      ipHash:   hashIp(ip),   // SHA-256 hash — never raw IP
    });

    // Increment the fast counter on the url row
    await UrlModel.incrementClickCount(urlRecord.id);

  } catch (err) {
    // Analytics failure must never affect the redirect
    console.error('Analytics pipeline error (non-fatal):', err.message);
  }
}

module.exports = { trackClick };