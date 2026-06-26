const validator = require('validator');

// Dangerous URL schemes — these aren't real web URLs
const BLOCKED_SCHEMES = ['javascript:', 'data:', 'vbscript:', 'file:'];

// Private/internal IP ranges — block SSRF attacks
// (someone shortening http://192.168.1.1/admin to probe internal network)
const PRIVATE_IP_REGEX = /^https?:\/\/(localhost|127\.|192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/i;

// Slugs the system uses for its own routes — can't be claimed as custom slugs
const RESERVED_SLUGS = new Set([
  'api', 'admin', 'dashboard', 'login', 'register',
  'health', 'static', 'b', 'preview', 'qr', 'auth',
]);

// ── isValidUrl(url) ───────────────────────────────────────────
// Returns { valid: true } or { valid: false, reason: '...' }
function isValidUrl(url) {
  if (!url || typeof url !== 'string') {
    return { valid: false, reason: 'URL is required' };
  }

  const trimmed = url.trim();

  // Block dangerous schemes before anything else
  const lower = trimmed.toLowerCase();
  for (const scheme of BLOCKED_SCHEMES) {
    if (lower.startsWith(scheme)) {
      return { valid: false, reason: `Scheme "${scheme}" is not allowed` };
    }
  }

  // Block private IPs (SSRF protection)
  if (PRIVATE_IP_REGEX.test(trimmed)) {
    return { valid: false, reason: 'Private/internal URLs are not allowed' };
  }

  // Use validator.js for the heavy lifting
  const isUrl = validator.isURL(trimmed, {
    protocols: ['http', 'https'],
    require_protocol: true,   // must start with http:// or https://
    require_tld: true,        // must have a real domain (no bare IPs)
  });

  if (!isUrl) {
    return { valid: false, reason: 'Invalid URL format' };
  }

  return { valid: true };
}

// ── isValidCustomSlug(slug) ───────────────────────────────────
// Validates a user-chosen custom slug (Day 17 feature)
function isValidCustomSlug(slug) {
  if (!slug || typeof slug !== 'string') {
    return { valid: false, reason: 'Slug is required' };
  }

  if (RESERVED_SLUGS.has(slug.toLowerCase())) {
    return { valid: false, reason: `"${slug}" is a reserved word` };
  }

  // Only allow alphanumeric + hyphens, 3–30 chars
  if (!/^[a-zA-Z0-9-]{3,30}$/.test(slug)) {
    return { valid: false, reason: 'Slug must be 3–30 characters, letters/numbers/hyphens only' };
  }

  return { valid: true };
}

module.exports = { isValidUrl, isValidCustomSlug, RESERVED_SLUGS };