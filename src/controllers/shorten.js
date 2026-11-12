const db = require('../lib/db');
const { generateSlug } = require('../utils/slug');
const { validateLink, publicLink } = require('../services/links');
async function shorten(req, res, next) {
  let client;
  try {
    const data = await validateLink(req.body);
    client = await db.pool.connect();
    await client.query('BEGIN');
    let row;
    // Custom slugs may occupy an ID-derived slug. Retry with a new sequence ID.
    for (let attempt = 0; attempt < 20; attempt++) {
      const { rows } = await client.query("SELECT nextval(pg_get_serial_sequence('urls','id')) AS id");
      const id = Number(rows[0].id);
      const slug = req.body.custom_slug || generateSlug(id);
      const result = await client.query(`INSERT INTO urls(id,slug,long_url,user_id,expires_at,max_clicks,password_hash,rules,og_title,og_description,og_image)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) ON CONFLICT(slug) DO NOTHING RETURNING *`,
      [id,slug,data.long_url,req.user?.id || null,data.expires_at,data.max_clicks,data.password_hash,JSON.stringify(data.rules),data.og_title,data.og_description,data.og_image]);
      if (result.rows[0]) { row = result.rows[0]; break; }
      if (req.body.custom_slug) throw Object.assign(new Error('Custom slug already exists'), { status: 409 });
    }
    if (!row) throw new Error('Unable to allocate a slug');
    await client.query('COMMIT');
    res.status(201).json(publicLink(row));
  } catch (err) { if (client) await client.query('ROLLBACK'); next(err); }
  finally { client?.release(); }
}
module.exports = { shorten };
