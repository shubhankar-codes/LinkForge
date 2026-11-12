const UAParser = require('ua-parser-js');
const crypto = require('crypto');

function parseUserAgent(uaString) {
  if (!uaString) {
    return { device: 'unknown', browser: 'other' };
  }

  const parser = new UAParser(uaString);
  const result = parser.getResult();

  const deviceType = result.device?.type;

  const device =
    deviceType === 'mobile'
      ? 'mobile'
      : deviceType === 'tablet'
      ? 'tablet'
      : 'desktop';

  const browserName = (result.browser?.name || '').toLowerCase();

  const browser = browserName.includes('edge')
    ? 'edge'
    : browserName.includes('chrome')
    ? 'chrome'
    : browserName.includes('firefox')
    ? 'firefox'
    : browserName.includes('safari')
    ? 'safari'
    : browserName.includes('edge')
    ? 'edge'
    : 'other';

  return { device, browser };
}

function hashIp(ip) {
  if (!ip) return null;
  return crypto.createHash('sha256').update(`${process.env.ANALYTICS_SALT || 'linkforge'}:${new Date().toISOString().slice(0,10)}:${ip}`).digest('hex');
}

function getClientIp(req) {
  if (req.ip) return req.ip;
  return req.socket?.remoteAddress || null;
}

function getReferrer(req) {
  return req.headers['referer'] || req.headers['referrer'] || null;
}

module.exports = {
  parseUserAgent,
  hashIp,
  getClientIp,
  getReferrer,
};