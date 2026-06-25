// Central error handler — Express calls this when any route does next(err)
// Must have 4 params (err, req, res, next) — Express detects this signature
function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  const status = err.status || 500;

  // Log full error in development, just the message in production
  if (process.env.NODE_ENV !== 'production') {
    console.error('❌', err.stack);
  } else {
    console.error('❌', err.message);
  }

  res.status(status).json({
    error: {
      message: err.message || 'Internal server error',
      // only include stack trace in development
      ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
    },
  });
}

// Helper to create consistent errors anywhere in the app:
//   throw createError(404, 'Slug not found')
function createError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

module.exports = { errorHandler, createError };