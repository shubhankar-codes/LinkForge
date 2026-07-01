const express  = require('express');
const router   = express.Router();
const { redirect } = require('../controllers/redirect');

// GET /:slug — registered LAST in app.js so it doesn't intercept /api/* routes
// This single route handles 99% of all traffic in the entire app
router.get('/:slug', redirect);

module.exports = router;