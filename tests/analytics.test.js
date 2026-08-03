const { isPrivateIp } = require('../src/services/geo');
const { parseUserAgent, hashIp, getClientIp, getReferrer } = require('../src/utils/parseRequest');

// ── isPrivateIp ───────────────────────────────────────────────
describe('isPrivateIp()', () => {
  test('identifies IPv4 localhost', () => {
    expect(isPrivateIp('127.0.0.1')).toBe(true);
  });

  test('identifies IPv6 localhost', () => {
    expect(isPrivateIp('::1')).toBe(true);
  });

  test('identifies class A private range', () => {
    expect(isPrivateIp('10.0.0.1')).toBe(true);
    expect(isPrivateIp('10.255.255.255')).toBe(true);
  });

  test('identifies class C private range', () => {
    expect(isPrivateIp('192.168.1.100')).toBe(true);
  });

  test('identifies class B private range', () => {
    expect(isPrivateIp('172.16.0.1')).toBe(true);
    expect(isPrivateIp('172.31.255.255')).toBe(true);
  });

  test('passes public IPs through', () => {
    expect(isPrivateIp('8.8.8.8')).toBe(false);
    expect(isPrivateIp('1.1.1.1')).toBe(false);
    expect(isPrivateIp('103.21.244.1')).toBe(false); // Cloudflare India
  });

  test('handles null gracefully', () => {
    expect(isPrivateIp(null)).toBe(false);
  });
});

// ── parseUserAgent ────────────────────────────────────────────
describe('parseUserAgent() — extended', () => {
  test('tablet detection', () => {
    const ua = 'Mozilla/5.0 (iPad; CPU OS 16_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1';
    const { device } = parseUserAgent(ua);
    expect(device).toBe('tablet');
  });

  test('Edge browser detection', () => {
    const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0';
    const { browser } = parseUserAgent(ua);
    expect(browser).toBe('edge');
  });

  test('unknown browser maps to other', () => {
    const { browser } = parseUserAgent('curl/7.88.1');
    expect(browser).toBe('other');
  });
});

// ── hashIp ────────────────────────────────────────────────────
describe('hashIp() — privacy', () => {
  test('raw IP is not stored — only hash', () => {
    const ip   = '103.21.244.1';
    const hash = hashIp(ip);
    expect(hash).not.toContain('103.21');  // IP not in the hash
    expect(hash).toHaveLength(64);         // SHA-256 hex output
  });

  test('consistent hashing across calls', () => {
    expect(hashIp('8.8.8.8')).toBe(hashIp('8.8.8.8'));
  });
});

// ── getClientIp — proxy handling ──────────────────────────────
describe('getClientIp() — proxy chain', () => {
  test('takes first IP from x-forwarded-for chain', () => {
    // Railway / Vercel send: client, proxy1, proxy2
    const req = {
      headers: { 'x-forwarded-for': '103.21.244.1, 10.0.0.1, 172.16.0.5' },
      socket: {}
    };
    expect(getClientIp(req)).toBe('103.21.244.1');
  });

  test('handles single IP in forwarded header', () => {
    const req = { headers: { 'x-forwarded-for': '8.8.8.8' }, socket: {} };
    expect(getClientIp(req)).toBe('8.8.8.8');
  });
});

// ── getReferrer ───────────────────────────────────────────────
describe('getReferrer() — source tracking', () => {
  test('WhatsApp share shows as null referrer (no referer header)', () => {
    // WhatsApp doesn't send referer — shows as direct/unknown
    const req = { headers: {} };
    expect(getReferrer(req)).toBeNull();
  });

  test('Twitter/X share detected correctly', () => {
    const req = { headers: { referer: 'https://t.co/abc123' } };
    expect(getReferrer(req)).toBe('https://t.co/abc123');
  });
});

// ── analytics service integration (mocked DB) ─────────────────
describe('trackClick() integration', () => {
  test('analytics module exports trackClick function', () => {
    // Mock dependencies before requiring
    jest.mock('../src/models/click', () => ({ logClick: jest.fn().mockResolvedValue() }));
    jest.mock('../src/models/url',   () => ({ incrementClickCount: jest.fn().mockResolvedValue() }));
    jest.mock('../src/services/geo', () => ({
      getCountry: jest.fn().mockResolvedValue('IN'),
      isPrivateIp: jest.fn().mockReturnValue(false),
    }));

    const { trackClick } = require('../src/services/analytics');
    expect(typeof trackClick).toBe('function');
  });
});