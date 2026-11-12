const jwt = require('jsonwebtoken');
const { createError } = require('./errorHandler');
function optionalAuth(req, res, next) {
  const token = req.headers.authorization?.replace(/^Bearer /, '');
  if (!token) return next();
  try { req.user = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] }); next(); }
  catch { next(createError(401, 'Session expired. Please sign in again.')); }
}
function auth(req, res, next) {
  optionalAuth(req, res, err => {
    if (err) return next(err);
    if (!req.user) return next(createError(401, 'Please sign in'));
    next();
  });
}
module.exports = { auth, optionalAuth };
