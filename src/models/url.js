const db = require('../lib/db');

// Insert URL row — slug starts as null, gets set right after
async function create(longUrl, userId = null) {
  const result = await db.query(
    `INSERT INTO urls (slug, long_url, user_id)
     VALUES ($1, $2, $3)
     RETURNING id`,
    [null, longUrl, userId]   // null avoids UNIQUE constraint collision on ""
  );
  return result.rows[0];
}

// Set the base62 slug after we have the auto id
async function setSlug(id, slug) {
  const result = await db.query(
    `UPDATE urls SET slug = $1 WHERE id = $2 RETURNING *`,
    [slug, id]
  );
  return result.rows[0];
}

// Core redirect lookup — must be fast (indexed on slug)
async function findBySlug(slug) {
  const result = await db.query(
    `SELECT * FROM urls WHERE slug = $1 LIMIT 1`,
    [slug]
  );
  return result.rows[0] || null;
}

// ── NEW: needed by redirect controller ───────────────────────
// Increments the fast counter — fire and forget, don't await in redirect path
async function incrementClickCount(id) {
  await db.query(
    `UPDATE urls SET click_count = click_count + 1 WHERE id = $1`,
    [id]
  );
}

// Dashboard: all links for a user, newest first (Day 15)
async function findByUserId(userId) {
  const result = await db.query(
    `SELECT id, slug, long_url, click_count, created_at, expires_at
     FROM urls WHERE user_id = $1 ORDER BY created_at DESC`,
    [userId]
  );
  return result.rows;
}

module.exports = { create, setSlug, findBySlug, incrementClickCount, findByUserId };