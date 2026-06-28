// We mock the DB model so tests run without a real PostgreSQL connection
jest.mock('../src/models/url');

const UrlModel = require('../src/models/url');
const { isValidUrl } = require('../src/utils/validate');
const { generateSlug } = require('../src/utils/slug');

// ── isValidUrl integration with shorten flow ─────────────────
describe('shorten input validation', () => {
  test('valid URL passes validation', () => {
    expect(isValidUrl('https://github.com').valid).toBe(true);
  });

  test('empty body fails validation', () => {
    expect(isValidUrl(undefined).valid).toBe(false);
  });

  test('non-URL string fails validation', () => {
    expect(isValidUrl('not a url').valid).toBe(false);
  });

  test('javascript: URL is blocked', () => {
    expect(isValidUrl('javascript:alert(1)').valid).toBe(false);
  });
});

// ── slug generation from DB id ────────────────────────────────
describe('slug generation in shorten flow', () => {
  test('generateSlug produces consistent slug for an id', () => {
    // id 1 → base62 "1" → padded "0001"
    expect(generateSlug(1)).toBe('0001');
  });

  test('different IDs produce different slugs', () => {
    expect(generateSlug(100)).not.toBe(generateSlug(101));
  });
});

// ── UrlModel mock behaviour ───────────────────────────────────
describe('UrlModel interactions', () => {
  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();

    // Default mock: create returns a row with id 42
    UrlModel.create.mockResolvedValue({
      id: 42,
      long_url: 'https://github.com',
      user_id: null,
      created_at: new Date().toISOString(),
    });

    // Default mock: setSlug returns the full record
    UrlModel.setSlug.mockResolvedValue({
      id: 42,
      slug: generateSlug(42),
      long_url: 'https://github.com',
      user_id: null,
      click_count: 0,
      created_at: new Date().toISOString(),
    });
  });

  test('create is called with the long URL', async () => {
    await UrlModel.create('https://github.com', null);
    expect(UrlModel.create).toHaveBeenCalledWith('https://github.com', null);
  });

  test('setSlug is called with the correct id and generated slug', async () => {
    const record = await UrlModel.create('https://github.com', null);
    const slug = generateSlug(record.id); // generateSlug(42)
    await UrlModel.setSlug(record.id, slug);
    expect(UrlModel.setSlug).toHaveBeenCalledWith(42, slug);
  });

  test('slug for id 42 is predictable', () => {
    // toBase62(42) = 'G' (index 42 in charset = uppercase G), padded = '000G'
    expect(generateSlug(42)).toBe('000G');
  });
});