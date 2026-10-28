/** @jest-environment node */
jest.mock('../src/lib/db', () => ({ query: jest.fn() }));
jest.mock('../src/lib/cache', () => ({ getSlug: jest.fn(), setSlug: jest.fn(), invalidateSlug: jest.fn() }));
jest.mock('../src/services/analytics', () => ({ trackClick: jest.fn().mockResolvedValue() }));
const db = require('../src/lib/db');
const cache = require('../src/lib/cache');
const UrlModel = require('../src/models/url');
const { redirect } = require('../src/controllers/redirect');
const { shorten } = require('../src/controllers/shorten');
const { logClick } = require('../src/models/click');
const { getClientIp } = require('../src/utils/parseRequest');

beforeEach(() => jest.clearAllMocks());

test('creation inserts a complete row with a non-null slug', async () => {
  db.query.mockResolvedValueOnce({ rows: [{ id: '42' }] })
    .mockResolvedValueOnce({ rows: [{ id: 42, slug: '000G' }] });
  expect(await UrlModel.create('https://example.com')).toEqual({ id: 42, slug: '000G' });
  expect(db.query.mock.calls[1][1]).toEqual([42, '000G', 'https://example.com', null]);
});

test('custom slug collision returns 409 without leaving an incomplete row', async () => {
  db.query.mockResolvedValueOnce({ rows: [{ id: '43' }] })
    .mockRejectedValueOnce({ code: '23505', constraint: 'urls_slug_unique' });
  await expect(UrlModel.create('https://example.com', null, 'brand')).rejects.toMatchObject({ status: 409 });
});

test('generated slug retries when a custom slug already owns the value', async () => {
  db.query.mockResolvedValueOnce({ rows: [{ id: '42' }] })
    .mockRejectedValueOnce({ code: '23505', constraint: 'urls_slug_unique' })
    .mockResolvedValueOnce({ rows: [{ id: '43' }] })
    .mockResolvedValueOnce({ rows: [{ id: 43, slug: '000H' }] });
  expect((await UrlModel.create('https://example.com')).slug).toBe('000H');
});

test.each(['api', '../bad', 'a'.repeat(11), 123])('rejects invalid custom slug %s before writing', async custom_slug => {
  const next = jest.fn();
  await shorten({ body: { url: 'https://example.com', custom_slug } }, {}, next);
  expect(next.mock.calls[0][0].status).toBe(400);
  expect(db.query).not.toHaveBeenCalled();
});

test('expired cached links return 410 instead of redirecting', async () => {
  cache.getSlug.mockResolvedValueOnce(JSON.stringify({ id: 1, long_url: 'https://example.com', expires_at: '2000-01-01T00:00:00Z' }));
  const res = { redirect: jest.fn() }, next = jest.fn();
  await redirect({ params: { slug: 'test' } }, res, next);
  expect(res.redirect).not.toHaveBeenCalled();
  expect(next.mock.calls[0][0].status).toBe(410);
});

test('valid cache hit redirects without reading the database', async () => {
  cache.getSlug.mockResolvedValueOnce(JSON.stringify({ id: 1, long_url: 'https://example.com', expires_at: null }));
  const res = { redirect: jest.fn() }, next = jest.fn();
  await redirect({ params: { slug: 'test' } }, res, next);
  expect(res.redirect).toHaveBeenCalledWith(302, 'https://example.com');
  expect(db.query).not.toHaveBeenCalled();
  expect(next).not.toHaveBeenCalled();
});

test('legacy cache entry is reloaded from the database and checked for expiry', async () => {
  cache.getSlug.mockResolvedValueOnce('https://example.com');
  db.query.mockResolvedValueOnce({ rows: [{ id: 1, expires_at: '2000-01-01T00:00:00Z' }] });
  const next = jest.fn();
  await redirect({ params: { slug: 'test' } }, { redirect: jest.fn() }, next);
  expect(next.mock.calls[0][0].status).toBe(410);
});

test('click insert uses columns defined by the database schema', async () => {
  db.query.mockResolvedValueOnce({ rows: [] });
  await logClick({ urlId: 1, country: 'IN', ipHash: 'abc' });
  expect(db.query.mock.calls[0][0]).toContain('country, device, browser, referrer, ip_hash');
});

test('untrusted forwarded headers cannot override socket IP', () => {
  expect(getClientIp({ headers: { 'x-forwarded-for': '8.8.8.8' }, socket: { remoteAddress: '127.0.0.1' } })).toBe('127.0.0.1');
});

test('shorten returns the complete saved link and trims input', async () => {
  db.query.mockResolvedValueOnce({ rows: [{ id: '42' }] })
    .mockResolvedValueOnce({ rows: [{ id: 42, slug: 'brand', long_url: 'https://example.com', created_at: 'today' }] });
  const res = { status: jest.fn().mockReturnThis(), json: jest.fn() }, next = jest.fn();
  await shorten({ body: { url: ' https://example.com ', custom_slug: 'brand' } }, res, next);
  expect(res.status).toHaveBeenCalledWith(201);
  expect(res.json.mock.calls[0][0]).toMatchObject({ slug: 'brand', long_url: 'https://example.com' });
  expect(db.query.mock.calls[1][1]).toEqual([42, 'brand', 'https://example.com', null]);
  expect(next).not.toHaveBeenCalled();
});

test('Express app loads with all route dependencies', () => {
  const app = require('../src/app');
  expect(typeof app.listen).toBe('function');
});

test('HTTP routes reject invalid input, enforce rate limits, and block expired cached links', async () => {
  const app = require('../src/app');
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    expect((await fetch(base + '/api/health')).status).toBe(200);
    for (let i = 0; i < 10; i++) {
      const response = await fetch(base + '/api/shorten', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
      });
      expect(response.status).toBe(400);
    }
    expect((await fetch(base + '/api/shorten', { method: 'POST' })).status).toBe(429);
    cache.getSlug.mockResolvedValueOnce(JSON.stringify({ id: 1, long_url: 'https://example.com', expires_at: '2000-01-01T00:00:00Z' }));
    expect((await fetch(base + '/expired', { redirect: 'manual' })).status).toBe(410);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});
