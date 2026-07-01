const db = require('../lib/db');

async function logClick({ urlId, country, device, browser, referrer, ipHash }) {
  await db.query(
    `INSERT INTO clicks (url_id, couuntry, device, browser, referrer, ipHash, created_at)
    VALUES($1, $2, $3, $4, $5, $6, NOW())`,
    [urlId, country || null, device || null, browser || null, referrer || null, ipHash ||null ]
  );
}

module.exports = {logClick};