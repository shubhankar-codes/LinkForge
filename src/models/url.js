const db = require("../lib/db");
const cache = require("../lib/cache");
const { generateSlug } = require("../utils/slug");

async function create(longUrl, userId = null, customSlug = null) {
  // Reserve an ID first, then insert a complete row. Sequence gaps are harmless.
  for (let attempt = 0; attempt < 5; attempt++) {
    const sequence = await db.query(
      "SELECT nextval(pg_get_serial_sequence('urls', 'id')) AS id"
    );
    const id = Number(sequence.rows[0].id);
    const slug = customSlug || generateSlug(id);
    try {
      const result = await db.query(
        'INSERT INTO urls (id, slug, long_url, user_id) VALUES ($1, $2, $3, $4) RETURNING *',
        [id, slug, longUrl, userId]
      );
      return result.rows[0];
    } catch (err) {
      if (err.code !== '23505' || err.constraint !== 'urls_slug_unique') throw err;
      if (customSlug) {
        const conflict = new Error('This slug is already in use');
        conflict.status = 409;
        throw conflict;
      }
      // A custom slug may have claimed this generated value. Try the next ID.
    }
  }
  const err = new Error('Unable to allocate a slug; please retry');
  err.status = 503;
  throw err;
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