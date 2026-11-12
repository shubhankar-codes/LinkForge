function getBaseUrl(env = process.env) {
  return (env.BASE_URL || env.RENDER_EXTERNAL_URL || `http://localhost:${env.PORT || 3000}`).replace(/\/+$/, '');
}
module.exports = { getBaseUrl };
