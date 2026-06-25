const express = require('express');
const router = express.Router();

router.get('/health' , (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime())
  });
});


router.post('/shorten', (req, res) => {
  res.status(501). json({ error: { message: 'Comming on Day 5'}});

});

router.get('/stats/:shortCode', (req, res) => {
  res.status(501).json({ error: { message: 'Comming on Day 5'} });
});

module.exports = router;
