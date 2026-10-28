const { rateLimit } = require('express-rate-limit');

function limiter(limit) {
  return rateLimit({
    windowMs: 60 * 1000,
    limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: { status: 429, message: 'Too many requests; please try again later' } },
  });
}

module.exports = {
  shortenLimiter: limiter(10),
  redirectLimiter: limiter(120),
  authLimiter: limiter(5),
  statsLimiter: limiter(30),
};
