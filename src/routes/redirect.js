const express = require('express');
const router = express.Router();

router.get('/health', (req, res) => {
  const {slug} = req.params;

  res.json({
    message: 'Redirect route is working',
    slug,
    note: 'Full implementation will be provided on Day 6',
  });
});

module.exports = router;