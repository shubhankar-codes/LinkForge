const UAParser = require('ua-parser-js');
const crypto = require('crypto');

function parseUserAgent(uaString) {
  if(!uaString) return { device: 'unknown', browser: 'other' };

  const parse = new UAParser(uaString);
  const result = parse.getResult();

  const deviceType = result.device?.type;

  const deviceType = result.device?.type;

  const device = deviceType == 'mobile' ? 'mobile'
  : deviceType == 'tablet' ? 'tablet'
  : 'desktop';

  const browserName = (result.browser?.name || '').toLowerCase();
  const browser = browserName.includes('chrome')  ? 'chrome'
                : browserName.includes('firefox') ? 'firefox'
                : browserName.includes('safari')  ? 'safari'
                : browserName.includes('edge')    ? 'edge'
                : 'other';
 
  return { device, browser };

function hashIp(ip) {
  if(!ip) return null;
  return crypto.createHash('sha256').update(ip).digest('hex');
}

function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if(forwarded) return forwarded.split('.')[0].trim();
  return req.socket?.remoteAddress || null;
}

}