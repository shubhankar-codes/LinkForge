// Public-IP geolocation over HTTPS; failures fall back to unknown country.
// Returns country code like "IN", "US", "GB"
// Country rules need a bounded lookup before redirect; analytics resolve afterward.

const GEO_API = process.env.GEO_API_URL || 'https://ipwho.is';

// Simple in-process cache so the same IP isn't looked up twice per process
// Resets on server restart — good enough for our use case
const geoCache = new Map();
const CACHE_MAX = 1000; // prevent unbounded memory growth

async function getCountry(ip) {
  ip = ip?.replace(/^::ffff:/, '');
  // Skip lookup for private/local IPs — they won't resolve to a country
  if (!ip || isPrivateIp(ip)) return null;

  // Check in-process cache first
  if (geoCache.has(ip)) return geoCache.get(ip);

  try {
    // Timeout after 2s — if geo API is slow, skip it, don't hang
    const controller = new AbortController();
    const timeout    = setTimeout(() => controller.abort(), 2000);

    const res  = await fetch(`${GEO_API}/${ip}`, { signal: controller.signal });
    clearTimeout(timeout);

    const data = await res.json();

    // ip-api returns { status: "success", countryCode: "IN", ... }
    const country = (data.success === true || data.status === 'success') ? (data.country_code || data.countryCode) : null;

    // Cache it — evict oldest if we hit the limit
    if (geoCache.size >= CACHE_MAX) {
      const firstKey = geoCache.keys().next().value;
      geoCache.delete(firstKey);
    }
    geoCache.set(ip, country);

    return country; // "IN", "US", null
  } catch {
    // Geo API is down or timed out — not critical, just skip
    return null;
  }
}

// ── isPrivateIp ───────────────────────────────────────────────
// No point calling geo API for localhost or internal network IPs
function isPrivateIp(ip) {
  if (!ip) return false;
  ip = ip.replace(/^::ffff:/, '');  // null/undefined → treat as unknown, not private
  return (
    ip === '::1'          ||   // IPv6 localhost
    ip.startsWith('127.')    ||   // IPv4 localhost
    ip.startsWith('169.254.') || ip.startsWith('fc') || ip.startsWith('fd') || ip.startsWith('fe80:') || ip.startsWith('10.')  ||   // private class A
    ip.startsWith('192.168.') ||  // private class C
    /^172\.(1[6-9]|2\d|3[01])\./.test(ip) // private class B
  );
}

module.exports = { getCountry, isPrivateIp };