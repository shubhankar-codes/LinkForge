const express            = require('express');
const router             = express.Router();
const { shorten }        = require('../controllers/shorten');
const { stats }          = require('../controllers/stats');
const { shortenLimiter, statsLimiter } = require('../middleware/rateLimiter');
const cache              = require('../lib/cache');

// Health — no limit, monitoring tools ping this constantly
router.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// POST /api/shorten — 10 per minute per IP
router.post('/shorten', shortenLimiter, shorten);

// Cache hit/miss metrics
router.get('/cache/stats', async (req, res, next) => {
  try { res.json(await cache.getMetrics()); }
  catch (err) { next(err); }
});

// Public aggregate analytics — 30 requests per minute per IP.
router.get('/stats/:slug', statsLimiter, stats);

module.exports = router;