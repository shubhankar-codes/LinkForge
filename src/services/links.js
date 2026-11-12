const { getBaseUrl } = require('../utils/baseUrl');
const bcrypt = require('bcryptjs');
const { isValidUrl, isValidCustomSlug } = require('../utils/validate');
const { createError } = require('../middleware/errorHandler');
const check = (condition, message) => { if (!condition) throw createError(400, message); };
async function validateLink(body) {
  check(body && typeof body === 'object', 'Link data is required');
  const result = isValidUrl(body.url);
  check(result.valid, result.reason);
  if (body.custom_slug) { const v = isValidCustomSlug(body.custom_slug); check(v.valid, v.reason); }
  check(!body.expires_at || Number.isFinite(Date.parse(body.expires_at)), 'Invalid expiry date');
  check(!body.expires_at || Date.parse(body.expires_at) > Date.now(), 'Expiry must be in the future');
  check(body.max_clicks == null || (Number.isSafeInteger(body.max_clicks) && body.max_clicks > 0), 'Click limit must be a positive integer');
  const rules = body.rules || [];
  check(Array.isArray(rules) && rules.length <= 20, 'Use at most 20 rules');
  for (const r of rules) {
    check(r && ['country', 'device'].includes(r.type), 'Invalid rule type');
    check(typeof r.match === 'string' && (r.type === 'country' ? /^[A-Z]{2}$/.test(r.match) : ['mobile', 'desktop', 'tablet'].includes(r.match)), 'Invalid rule match');
    check(isValidUrl(r.destination).valid, 'Invalid rule destination');
  }
  for (const [key, limit] of [['og_title',100], ['og_description',200]]) check(!body[key] || (typeof body[key] === 'string' && body[key].length <= limit), `${key} is too long`);
  check(!body.og_image || isValidUrl(body.og_image).valid, 'Invalid preview image URL');
  check(!body.password || (typeof body.password === 'string' && body.password.length >= 6 && body.password.length <= 72), 'Link password must be 6–72 characters');
  return { long_url: body.url.trim(), expires_at: body.expires_at || null, max_clicks: body.max_clicks ?? null,
    rules, password_hash: body.password ? await bcrypt.hash(body.password, 10) : null,
    og_title: body.og_title || null, og_description: body.og_description || null, og_image: body.og_image || null };
}
function publicLink(row) {
  const { password_hash, ...rest } = row;
  return { ...rest, protected: !!password_hash, short_url: `${getBaseUrl()}/${row.slug}` };
}
module.exports = { validateLink, publicLink, check };
