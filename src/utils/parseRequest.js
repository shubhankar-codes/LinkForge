const UAParser = require('ua-parser-js');
const crypto = require('crypto');
const fallbackSecret = crypto.randomBytes(32).toString('hex');

function parseUserAgent(uaString) {
  if (!uaString) return { device: 'unknown', browser: 'other' };
  const result = new UAParser(uaString).getResult();
  const type = result.device?.type;
  const device = type === 'mobile' ? 'mobile' : type === 'tablet' ? 'tablet' : 'desktop';
  const name = (result.browser?.name || '').toLowerCase();
  const browser = name.includes('edge') ? 'edge'
    : name.includes('chrome') ? 'chrome'
    : name.includes('firefox') ? 'firefox'
    : name.includes('safari') ? 'safari' : 'other';
  return { device, browser };
}

function hashIp(ip) {
  if (!ip) return null;
  const day = new Date().toISOString().slice(0, 10);
  const secret = process.env.IP_HASH_SECRET || fallbackSecret;
  return crypto.createHmac('sha256', secret).update(day + ':' + ip).digest('hex');
}

function getClientIp(req) {
  // Express honours forwarded headers only when trust proxy is configured.
  return req.ip || req.socket?.remoteAddress || null;
}

function getReferrer(req) {
  return req.headers.referer || req.headers.referrer || null;
}

module.exports = { parseUserAgent, hashIp, getClientIp, getReferrer };
