const db = require('../lib/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { createError } = require('../middleware/errorHandler');
const { parseUserAgent, getClientIp } = require('../utils/parseRequest');
const { getCountry } = require('../services/geo');
const { trackClick } = require('../services/analytics');
const { escape, page } = require('../utils/html');
async function redirect(req, res, next) {
  try {
    // Always consult the authoritative row: cached destinations must not bypass gates or limits.
    const record = (await db.query('SELECT * FROM urls WHERE slug=$1', [req.params.slug])).rows[0];
    if (!record) throw createError(404, 'Link not found');
    if ((record.expires_at && new Date(record.expires_at) <= new Date()) || (record.max_clicks && record.click_count >= record.max_clicks)) throw createError(410, 'This link has expired');
    res.set('Cache-Control', 'no-store');
    if (record.password_hash) {
      let unlocked = false;
      const cookie = req.headers.cookie?.split('; ').find(c => c.startsWith('lf_gate='))?.slice(8);
      if (cookie) { try { const gate = jwt.verify(cookie, process.env.JWT_SECRET, { algorithms: ['HS256'] }); unlocked = gate.slug === record.slug && gate.version === crypto.createHash('sha256').update(record.password_hash).digest('hex'); } catch { /* Invalid or expired unlock token. */ } }
      if (!unlocked && req.method === 'POST') {
        unlocked = typeof req.body.password === 'string' && req.body.password.length <= 72 && await bcrypt.compare(req.body.password, record.password_hash);
        if (unlocked) {
          res.cookie('lf_gate', jwt.sign({slug:record.slug,version:crypto.createHash('sha256').update(record.password_hash).digest('hex')}, process.env.JWT_SECRET, {expiresIn:'15m'}), {httpOnly:true,sameSite:'lax',secure:process.env.NODE_ENV === 'production',path:`/${record.slug}`,maxAge:900000});
          return res.redirect(303, `/${record.slug}`);
        }
      }
      if (!unlocked) return res.status(req.method === 'POST' ? 401 : 200).send(page('Protected link', `<h1>A little privacy.</h1><p>This link is protected. Enter its password to continue.</p><form method="post" action="/${escape(record.slug)}"><label>Password<input type="password" name="password" required maxlength="72" autocomplete="current-password"></label><button>Unlock link ↗</button></form>${req.method === 'POST' ? '<p role="alert">Incorrect password. Try again.</p>' : ''}`));
    }
    const rules = record.rules || [];
    let destination = record.long_url;
    const device = parseUserAgent(req.headers['user-agent']).device;
    const country = rules.some(r => r.type === 'country') ? await getCountry(getClientIp(req)) : null;
    const rule = rules.find(r => r.match === (r.type === 'device' ? device : country));
    if (rule) destination = rule.destination;
    if (req.method === 'HEAD') return res.redirect(302, destination);
    const accepted = await db.query(`UPDATE urls SET click_count=click_count+1 WHERE id=$1 AND (max_clicks IS NULL OR click_count<max_clicks) AND (expires_at IS NULL OR expires_at>NOW()) RETURNING id`, [record.id]);
    if (!accepted.rowCount) throw createError(410, 'This link has expired');
    res.redirect(302, destination);
    trackClick(req, record).catch(err => console.error('Analytics:', err.message));
  } catch (err) { next(err); }
}
module.exports = { redirect };
