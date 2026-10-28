const db = require('../lib/db');

async function logClick({ urlId, country, device, browser, referrer, ipHash }) {
  await db.query(
    `INSERT INTO clicks (url_id, country, device, browser, referrer, ip_hash, created_at)
    VALUES($1, $2, $3, $4, $5, $6, NOW())`,
    [urlId, country || null, device || null, browser || null, referrer || null, ipHash ||null ]
  );
}

module.exports = {logClick};