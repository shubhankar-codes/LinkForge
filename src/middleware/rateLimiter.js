const rateLimit = require('express-rate-limit');

// ── Shared response handler ───────────────────────────────────
// Makes 429 look the same as every other error in the app
const rateLimitHandler = (req, res) => {
  res.status(429).json({
    error: {
      message: 'Too many requests — please slow down',
      retryAfter: `${Math.ceil((req.rateLimit.resetTime - Date.now()) / 1000)}s`,
    },
  });
};

// ── 1. Shorten limiter ────────────────────────────────────────
// POST /api/shorten — most important to protect
// Without this, someone can fill your DB with millions of junk links
// 10 requests per minute per IP
const shortenLimiter = rateLimit({
  windowMs:        60 * 1000,   // 1 minute window
  max:             10,           // 10 shortens per window
  standardHeaders: true,         // adds RateLimit-* headers to response
  legacyHeaders:   false,
  handler:         rateLimitHandler,
});

// ── 2. Redirect limiter ───────────────────────────────────────
// GET /:slug — looser, legitimate users click links repeatedly
// 60 per minute per IP — effectively 1/sec sustained
const redirectLimiter = rateLimit({
  windowMs:        60 * 1000,
  max:             60,
  standardHeaders: true,
  legacyHeaders:   false,
  handler:         rateLimitHandler,
});

// ── 3. Auth limiter ───────────────────────────────────────────
// POST /auth/login — brute force protection
// 5 attempts per 15 minutes per IP
const authLimiter = rateLimit({
  windowMs:               15 * 60 * 1000,  // 15 minutes
  max:                    5,
  standardHeaders:        true,
  legacyHeaders:          false,
  handler:                rateLimitHandler,
  skipSuccessfulRequests: true,  // legit logins don't burn the limit
});

module.exports = { shortenLimiter, redirectLimiter, authLimiter };