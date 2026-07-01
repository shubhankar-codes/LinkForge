const { parseUserAgent, hashIp, getClientIp, getReferrer } = require('../src/utils/parseRequest');

// ── parseUserAgent ────────────────────────────────────────────
describe('parseUserAgent()', () => {
  test('detects Chrome on desktop', () => {
    const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36';
    const { device, browser } = parseUserAgent(ua);
    expect(device).toBe('desktop');
    expect(browser).toBe('chrome');
  });

  test('detects Safari on mobile', () => {
    const ua = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1';
    const { device, browser } = parseUserAgent(ua);
    expect(device).toBe('mobile');
    expect(browser).toBe('safari');
  });

  test('detects Firefox on desktop', () => {
    const ua = 'Mozilla/5.0 (X11; Linux x86_64; rv:109.0) Gecko/20100101 Firefox/121.0';
    const { device, browser } = parseUserAgent(ua);
    expect(device).toBe('desktop');
    expect(browser).toBe('firefox');
  });

  test('handles missing UA gracefully', () => {
    const { device, browser } = parseUserAgent(null);
    expect(device).toBe('unknown');
    expect(browser).toBe('other');
  });

  test('handles empty string UA', () => {
    const { device, browser } = parseUserAgent('');
    expect(device).toBe('unknown');
    expect(browser).toBe('other');
  });
});

// ── hashIp ────────────────────────────────────────────────────
describe('hashIp()', () => {
  test('returns a 64-char hex string', () => {
    const hash = hashIp('192.168.1.1');
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[a-f0-9]+$/);
  });

  test('same IP always produces same hash', () => {
    expect(hashIp('1.2.3.4')).toBe(hashIp('1.2.3.4'));
  });

  test('different IPs produce different hashes', () => {
    expect(hashIp('1.2.3.4')).not.toBe(hashIp('5.6.7.8'));
  });

  test('returns null for missing IP', () => {
    expect(hashIp(null)).toBeNull();
    expect(hashIp(undefined)).toBeNull();
  });
});

// ── getClientIp ───────────────────────────────────────────────
describe('getClientIp()', () => {
  test('reads x-forwarded-for header (proxy/CDN)', () => {
    const req = { headers: { 'x-forwarded-for': '1.2.3.4, 10.0.0.1' }, socket: {} };
    expect(getClientIp(req)).toBe('1.2.3.4'); // first IP in the chain
  });

  test('falls back to socket remoteAddress when no proxy header', () => {
    const req = { headers: {}, socket: { remoteAddress: '5.6.7.8' } };
    expect(getClientIp(req)).toBe('5.6.7.8');
  });

  test('returns null when no IP available', () => {
    const req = { headers: {}, socket: {} };
    expect(getClientIp(req)).toBeNull();
  });
});

// ── getReferrer ───────────────────────────────────────────────
describe('getReferrer()', () => {
  test('reads referer header', () => {
    const req = { headers: { referer: 'https://twitter.com' } };
    expect(getReferrer(req)).toBe('https://twitter.com');
  });

  test('also reads referrer header (alternate spelling)', () => {
    const req = { headers: { referrer: 'https://google.com' } };
    expect(getReferrer(req)).toBe('https://google.com');
  });

  test('returns null for direct visits (no header)', () => {
    const req = { headers: {} };
    expect(getReferrer(req)).toBeNull();
  });
});