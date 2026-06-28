const db = require("../lib/db");

async function create(longUrl, userId = null) {
  const result = await db.query(
    `INSERT INTO urls (slug, long_url, user_id)
     VALUES ($1, $2, $3)
     RETURNING id`,
    ["", longUrl, userId]
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
     WHERE slug = $1`,
    [slug]
  );

  return result.rows[0];
}

module.exports = {
  create,
  setSlug,
  findBySlug,
};