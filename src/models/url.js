const db = require("../lib/db");
const cache = require("../lib/cache");

async function create(longUrl, userId = null) {
  const result = await db.query(
    `INSERT INTO urls (slug, long_url, user_id)
     VALUES ($1, $2, $3)
     RETURNING id`,
    [null, longUrl, userId]
  );

  return result.rows[0];
}

async function setSlug(id, slug) {
  const result = await db.query(
    `UPDATE urls
     SET slug = $1
     WHERE id = $2
     RETURNING *`,
    [slug, id]
  );

  return result.rows[0];
}

async function findBySlug(slug) {
  const result = await db.query(
    `SELECT *
     FROM urls
     WHERE slug = $1
     LIMIT 1`,
    [slug]
  );

  return result.rows[0] || null;
}

async function incrementClickCount(id) {
  await db.query(
    `UPDATE urls
     SET click_count = click_count + 1
     WHERE id = $1`,
    [id]
  );
}

async function findByUserId(userId) {
  const result = await db.query(
    `SELECT id, slug, long_url, click_count, created_at, expires_at
     FROM urls
     WHERE user_id = $1
     ORDER BY created_at DESC`,
    [userId]
  );

  return result.rows;
}

async function updateLongUrl(id, newLongUrl, userId) {
  const result = await db.query(
    `UPDATE urls
     SET long_url = $1
     WHERE id = $2
       AND user_id = $3
     RETURNING *`,
    [newLongUrl, id, userId]
  );

  const updated = result.rows[0];

  if (updated) {
    await cache.invalidateSlug(updated.slug);
  }

  return updated || null;
}

async function deleteById(id, userId) {
  const existing = await db.query(
    `SELECT slug
     FROM urls
     WHERE id = $1
       AND user_id = $2`,
    [id, userId]
  );

  if (!existing.rows.length) {
    return false;
  }

  await db.query(`DELETE FROM urls WHERE id = $1`, [id]);

  await cache.invalidateSlug(existing.rows[0].slug);

  return true;
}

module.exports = {
  create,
  setSlug,
  findBySlug,
  incrementClickCount,
  findByUserId,
  updateLongUrl,
  deleteById,
};