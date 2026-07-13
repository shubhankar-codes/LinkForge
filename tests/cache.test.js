// Mock ioredis — tests run without a real Redis server
jest.mock('ioredis', () => {
  // Simple in-memory store that mimics Redis get/set/del
  const store = {};
  return jest.fn().mockImplementation(() => ({
    get:  jest.fn(async (k)      => store[k] ?? null),
    set:  jest.fn(async (k, v)   => { store[k] = v; return 'OK'; }),
    del:  jest.fn(async (...ks)  => { ks.forEach(k => delete store[k]); return ks.length; }),
    info: jest.fn(async ()       => 'used_memory_human:1.5M'),
    on:   jest.fn(), // redis.on('connect', ...) — just ignore in tests
    _store: store,   // expose for test inspection
  }));
});

const cache = require('../src/lib/cache');

// ── KEYS helper ───────────────────────────────────────────────
describe('KEYS namespace', () => {
  test('slug key is namespaced correctly', () => {
    expect(cache.KEYS.slug('abc')).toBe('snap:slug:abc');
  });

  test('user key is namespaced correctly', () => {
    expect(cache.KEYS.user(42)).toBe('snap:user:42');
  });

  test('stats key is namespaced correctly', () => {
    expect(cache.KEYS.stats('abc')).toBe('snap:stats:abc');
  });
});

// ── TTL values ────────────────────────────────────────────────
describe('TTL constants', () => {
  test('SLUG TTL is 1 hour', () => {
    expect(cache.TTL.SLUG).toBe(3600);
  });

  test('STATS TTL is 5 minutes', () => {
    expect(cache.TTL.STATS).toBe(300);
  });
});

// ── get / set / del ───────────────────────────────────────────
describe('get() and set()', () => {
  test('returns null for keys that do not exist', async () => {
    const result = await cache.get('snap:slug:nonexistent');
    expect(result).toBeNull();
  });

  test('set then get returns the value', async () => {
    await cache.set('snap:slug:test1', 'https://example.com');
    const result = await cache.get('snap:slug:test1');
    expect(result).toBe('https://example.com');
  });
});

// ── slug-specific helpers ─────────────────────────────────────
describe('getSlug() / setSlug() / invalidateSlug()', () => {
  test('setSlug stores under namespaced key', async () => {
    await cache.setSlug('xk9m', 'https://github.com');
    const result = await cache.getSlug('xk9m');
    expect(result).toBe('https://github.com');
  });

  test('invalidateSlug removes the key', async () => {
    await cache.setSlug('del1', 'https://google.com');
    await cache.invalidateSlug('del1');
    const result = await cache.getSlug('del1');
    expect(result).toBeNull();
  });

  test('getSlug returns null for unknown slug', async () => {
    const result = await cache.getSlug('notexist');
    expect(result).toBeNull();
  });
});

// ── metrics ───────────────────────────────────────────────────
describe('getMetrics()', () => {
  test('returns hit rate as percentage string', async () => {
    const m = await cache.getMetrics();
    expect(m.hitRate).toMatch(/^\d+\.\d+%$/);
  });

  test('returns numeric hit and miss counts', async () => {
    const m = await cache.getMetrics();
    expect(typeof m.hits).toBe('number');
    expect(typeof m.misses).toBe('number');
  });
});