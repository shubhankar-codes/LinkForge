const db = require('../lib/db');

async function getStatsBySlug(slug) {
  // One statement keeps totals and breakdowns in the same database snapshot.
  // Count stored clicks rather than the separately updated click_count counter.
  const result = await db.query(`
    WITH link AS (
      SELECT id, slug, long_url, created_at FROM urls WHERE slug = $1
    ), events AS (
      SELECT c.country, c.device, c.browser, c.created_at
      FROM clicks c JOIN link l ON l.id = c.url_id
    ), days AS (
      SELECT ((CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date - offset_day) AS day
      FROM generate_series(0, 6) AS offset_day
    )
    SELECT l.slug, l.long_url, l.created_at,
      (SELECT COUNT(*) FROM events)::integer AS total_clicks,
      COALESCE((
        SELECT jsonb_agg(row_to_json(g) ORDER BY g.clicks DESC, g.country)
        FROM (
          SELECT COALESCE(country, 'unknown') AS country, COUNT(*)::integer AS clicks
          FROM events GROUP BY COALESCE(country, 'unknown')
        ) g
      ), '[]'::jsonb) AS countries,
      COALESCE((
        SELECT jsonb_agg(row_to_json(g) ORDER BY g.clicks DESC, g.device)
        FROM (
          SELECT COALESCE(device, 'unknown') AS device, COUNT(*)::integer AS clicks
          FROM events GROUP BY COALESCE(device, 'unknown')
        ) g
      ), '[]'::jsonb) AS devices,
      COALESCE((
        SELECT jsonb_agg(row_to_json(g) ORDER BY g.clicks DESC, g.browser)
        FROM (
          SELECT COALESCE(browser, 'other') AS browser, COUNT(*)::integer AS clicks
          FROM events GROUP BY COALESCE(browser, 'other')
        ) g
      ), '[]'::jsonb) AS browsers,
      (
        SELECT jsonb_agg(row_to_json(g) ORDER BY g.date)
        FROM (
          SELECT to_char(d.day, 'YYYY-MM-DD') AS date, COUNT(e.created_at)::integer AS clicks
          FROM days d LEFT JOIN events e
            ON e.created_at >= (d.day::timestamp AT TIME ZONE 'UTC')
            AND e.created_at < ((d.day + 1)::timestamp AT TIME ZONE 'UTC')
          GROUP BY d.day
        ) g
      ) AS daily_clicks
    FROM link l
  `, [slug]);
  return result.rows[0] || null;
}

module.exports = { getStatsBySlug };
