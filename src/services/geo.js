// ip-api.com: free tier, no API key, 45 req/min limit
// Returns country code like "IN", "US", "GB"
// We call this async AFTER the redirect is sent — never blocks the user

const GEO_API = process.env.GEO_API_URL || 'http://ip-api.com/json';

// Simple in-process cache so the same IP isn't looked up twice per process
// Resets on server restart — good enough for our use case
const geoCache = new Map();
const CACHE_MAX = 1000; // prevent unbounded memory growth

async function getCountry(ip) {
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
    const country = data.status === 'success' ? data.countryCode : null;

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
  if (!ip) return false;  // null/undefined → treat as unknown, not private
  return (
    ip === '::1'          ||   // IPv6 localhost
    ip === '127.0.0.1'    ||   // IPv4 localhost
    ip.startsWith('10.')  ||   // private class A
    ip.startsWith('192.168.') ||  // private class C
    /^172\.(1[6-9]|2\d|3[01])\./.test(ip) // private class B
  );
}

module.exports = { getCountry, isPrivateIp };