const express      = require('express');
const router       = express.Router();
const { shorten }  = require('../controllers/shorten');
const cache        = require('../lib/cache');

// Health check
router.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// POST /api/shorten
router.post('/shorten', shorten);

// ── NEW: GET /api/cache/stats ─────────────────────────────────
// See live hit/miss ratio — run this in browser after a few redirects
router.get('/cache/stats', async (req, res, next) => {
  try {
    const stats = await cache.getMetrics();
    res.json(stats);
  } catch (err) {
    next(err);
  }
});

// Stats (Day 10)
router.get('/stats/:slug', (req, res) => {
  res.status(501).json({ error: { message: 'Coming on Day 10' } });
});

module.exports = router;