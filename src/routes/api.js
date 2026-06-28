const express  = require('express');
const router   = express.Router();
const { shorten } = require('../controllers/shorten');

// ── Health check ──────────────────────────────────────────────
router.get('/health', (req, res) => {
  res.json({
    status:    'ok',
    timestamp: new Date().toISOString(),
    uptime:    Math.floor(process.uptime()) + 's',
  });
});

// ── POST /api/shorten ─────────────────────────────────────────
// The main endpoint — validate URL, create short link, return it
router.post('/shorten', shorten);

// ── GET /api/stats/:slug  (Day 10) ───────────────────────────
router.get('/stats/:slug', (req, res) => {
  res.status(501).json({ error: { message: 'Coming on Day 10' } });
});

module.exports = router;