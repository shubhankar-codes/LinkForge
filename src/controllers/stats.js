const { getStatsBySlug } = require('../models/stats');
const { createError } = require('../middleware/errorHandler');

async function stats(req, res, next) {
  try {
    const { slug } = req.params;
    if (!/^[a-zA-Z0-9-]{1,10}$/.test(slug)) {
      throw createError(400, 'Invalid slug');
    }
    const result = await getStatsBySlug(slug);
    if (!result) throw createError(404, 'Short link not found');
    // Aggregated statistics are public while this project has no account auth.
    // Never return IP hashes, raw click rows, or user account information here.
    res.set('Cache-Control', 'no-store');
    res.json({ ...result, timezone: 'UTC', daily_window_days: 7 });
  } catch (err) {
    next(err);
  }
}

module.exports = { stats };
