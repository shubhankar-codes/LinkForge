// ── createError(status, message) ─────────────────────────────
// Used everywhere in the app to throw consistent HTTP errors:
//   throw createError(404, 'Slug not found')
function createError(status, message) {
  const err    = new Error(message);
  err.status   = status;
  err.isCustom = true; // flag so we know it's intentional, not a bug
  return err;
}

// ── errorHandler(err, req, res, next) ────────────────────────
// Express calls this when any route does next(err) or throws.
// Must have exactly 4 params — Express detects this signature.
function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  if (res.headersSent) return next(err);
  const status  = err.status || 500;
  const isDev   = process.env.NODE_ENV !== 'production';

  // Always log — full stack in dev, message only in prod
  if (isDev) {
    console.error(`❌ ${status}:`, err.stack);
  } else {
    console.error(`❌ ${status}:`, err.message);
  }

  // 500 errors — don't leak internal details to the client
  const message = status === 500 && !isDev
    ? 'Internal server error'
    : err.message;

  res.status(status).json({
    error: {
      message,
      status,
      // stack trace only in development
      ...(isDev && status === 500 && { stack: err.stack }),
    },
  });
}

// ── notFound handler ──────────────────────────────────────────
// Catches requests to routes that don't exist at all
// Register this BEFORE errorHandler in app.js
function notFound(req, res, next) {
  next(createError(404, `Route ${req.method} ${req.path} not found`));
}

module.exports = { createError, errorHandler, notFound };