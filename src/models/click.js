const db = require('../lib/db');

async function logClick({ urlId, country, device, browser, referrer, ipHash, utm = {} }) {
  await db.query(
    `INSERT INTO clicks (url_id, country, device, browser, referrer, ip_hash, utm_source, utm_medium, utm_campaign, created_at)
    VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())`,
    [urlId, country || null, device || null, browser || null, referrer || null, ipHash ||null, utm.utm_source, utm.utm_medium, utm.utm_campaign ]
  );
}

module.exports = {logClick};