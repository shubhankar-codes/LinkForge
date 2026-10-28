jest.mock('../src/lib/db', () => ({ query: jest.fn() }));
jest.mock('../src/lib/cache', () => ({}));
const db = require('../src/lib/db');
const { stats } = require('../src/controllers/stats');
const { getStatsBySlug } = require('../src/models/stats');

beforeEach(() => jest.resetAllMocks());

function response() {
  return { set: jest.fn().mockReturnThis(), json: jest.fn() };
}

test('returns aggregates, UTC metadata and disables response caching', async () => {
  const data = { slug: 'mygithub', total_clicks: 3, countries: [{ country: 'unknown', clicks: 3 }], devices: [], browsers: [], daily_clicks: [] };
  db.query.mockResolvedValue({ rows: [data] });
  const res = response(), next = jest.fn();
  await stats({ params: { slug: 'mygithub' } }, res, next);
  expect(res.json).toHaveBeenCalledWith({ ...data, timezone: 'UTC', daily_window_days: 7 });
  expect(res.set).toHaveBeenCalledWith('Cache-Control', 'no-store');
  expect(next).not.toHaveBeenCalled();
  expect(db.query.mock.calls[0][1]).toEqual(['mygithub']);
});

test('unknown slug returns 404', async () => {
  db.query.mockResolvedValue({ rows: [] });
  const next = jest.fn();
  await stats({ params: { slug: 'missing' } }, response(), next);
  expect(next.mock.calls[0][0].status).toBe(404);
});

test.each(['a'.repeat(11), "x' OR 1=1", 'bad_slug'])('rejects invalid slug %s without a database query', async slug => {
  const next = jest.fn();
  await stats({ params: { slug } }, response(), next);
  expect(next.mock.calls[0][0].status).toBe(400);
  expect(db.query).not.toHaveBeenCalled();
});

test('database failures reach the error middleware', async () => {
  const error = new Error('database unavailable');
  db.query.mockRejectedValue(error);
  const next = jest.fn();
  await stats({ params: { slug: 'link' } }, response(), next);
  expect(next).toHaveBeenCalledWith(error);
});

test('model uses a bound slug parameter', async () => {
  db.query.mockResolvedValue({ rows: [] });
  await getStatsBySlug("' OR 1=1");
  const [sql, params] = db.query.mock.calls[0];
  expect(sql).toContain('WHERE slug = $1');
  expect(sql).not.toContain("' OR 1=1");
  expect(params).toEqual(["' OR 1=1"]);
});

test('HTTP stats route is mounted, returns JSON, and rate limits repeated reads', async () => {
  db.query.mockResolvedValue({ rows: [{ slug: 'mygithub', total_clicks: 3 }] });
  const app = require('../src/app');
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const url = `http://127.0.0.1:${server.address().port}/api/stats/mygithub`;
  try {
    const res = await fetch(url);
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect((await res.json()).total_clicks).toBe(3);
    for (let i = 1; i < 30; i++) expect((await fetch(url)).status).toBe(200);
    expect((await fetch(url)).status).toBe(429);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});
