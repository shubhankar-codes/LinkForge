const { toBase62, fromBase62, generateSlug } = require('../src/utils/slug');
const { isValidUrl, isValidCustomSlug }      = require('../src/utils/validate');

// ── toBase62 ─────────────────────────────────────────────────
describe('toBase62()', () => {
  test('encodes 0 correctly', () => {
    expect(toBase62(0)).toBe('0');
  });

  test('encodes single digit values', () => {
    expect(toBase62(1)).toBe('1');
    expect(toBase62(9)).toBe('9');
  });

  test('encodes boundary: 10 → a (index 10 in charset)', () => {
    expect(toBase62(10)).toBe('a');
  });

  test('encodes boundary: 61 → Z (last char)', () => {
    expect(toBase62(61)).toBe('Z');
  });

  test('encodes boundary: 62 → 10 (rolls over like base10 does at 10)', () => {
    expect(toBase62(62)).toBe('10');
  });

  test('encodes large numbers', () => {
    expect(toBase62(10542)).toBe('2K2');
    expect(toBase62(1000000)).toBe('4c92');
  });

  test('throws on negative numbers', () => {
    expect(() => toBase62(-1)).toThrow();
  });

  test('throws on floats', () => {
    expect(() => toBase62(1.5)).toThrow();
  });
});

// ── fromBase62 ───────────────────────────────────────────────
describe('fromBase62()', () => {
  test('reverses toBase62 correctly', () => {
    const ids = [1, 10, 62, 100, 10542, 999999];
    ids.forEach(id => {
      expect(fromBase62(toBase62(id))).toBe(id);
    });
  });

  test('throws on invalid characters', () => {
    expect(() => fromBase62('abc!')).toThrow();
  });
});

// ── generateSlug ─────────────────────────────────────────────
describe('generateSlug()', () => {
  test('pads short slugs to minimum 4 chars', () => {
    expect(generateSlug(1).length).toBeGreaterThanOrEqual(4);
    expect(generateSlug(1)).toBe('0001');
  });

  test('pads 3-char slugs to 4 chars, leaves longer slugs alone', () => {
    expect(generateSlug(10542)).toBe('02K2');
    expect(generateSlug(10542).length).toBeGreaterThanOrEqual(4);
  });

  test('different IDs always produce different slugs', () => {
    const slugs = new Set();
    for (let i = 1; i <= 1000; i++) slugs.add(generateSlug(i));
    expect(slugs.size).toBe(1000); // all unique
  });
});

// ── isValidUrl ───────────────────────────────────────────────
describe('isValidUrl()', () => {
  test('accepts valid http URLs', () => {
    expect(isValidUrl('http://example.com').valid).toBe(true);
  });

  test('accepts valid https URLs with paths', () => {
    expect(isValidUrl('https://github.com/user/repo?tab=stars').valid).toBe(true);
  });

  test('rejects URLs without protocol', () => {
    expect(isValidUrl('example.com').valid).toBe(false);
  });

  test('rejects javascript: scheme (XSS)', () => {
    expect(isValidUrl('javascript:alert(1)').valid).toBe(false);
  });

  test('rejects data: scheme', () => {
    expect(isValidUrl('data:text/html,<h1>hi</h1>').valid).toBe(false);
  });

  test('rejects localhost (SSRF)', () => {
    expect(isValidUrl('http://localhost:8080/admin').valid).toBe(false);
  });

  test('rejects private IP ranges (SSRF)', () => {
    expect(isValidUrl('http://192.168.1.1').valid).toBe(false);
    expect(isValidUrl('http://10.0.0.1/secret').valid).toBe(false);
  });

  test('rejects empty string', () => {
    expect(isValidUrl('').valid).toBe(false);
  });

  test('rejects null', () => {
    expect(isValidUrl(null).valid).toBe(false);
  });
});

// ── isValidCustomSlug ─────────────────────────────────────────
describe('isValidCustomSlug()', () => {
  test('accepts valid slugs', () => {
    expect(isValidCustomSlug('my-brand').valid).toBe(true);
    expect(isValidCustomSlug('product2024').valid).toBe(true);
  });

  test('rejects reserved words', () => {
    expect(isValidCustomSlug('api').valid).toBe(false);
    expect(isValidCustomSlug('admin').valid).toBe(false);
  });

  test('rejects slugs that are too short', () => {
    expect(isValidCustomSlug('ab').valid).toBe(false);
  });

  test('rejects special characters', () => {
    expect(isValidCustomSlug('my_slug!').valid).toBe(false);
  });
});