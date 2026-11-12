const { databaseConfig } = require('../src/lib/dbConfig');
const { getBaseUrl } = require('../src/utils/baseUrl');
test('Neon connection preserves TLS query parameters and enables channel binding', () => {
  const url='postgresql://user:example@host-pooler.neon.tech/neondb?sslmode=require&channel_binding=require';
  const config=databaseConfig({DATABASE_URL:url});
  expect(config.connectionString).toBe(url);
  expect(config.enableChannelBinding).toBe(true);
  expect(config.connectionTimeoutMillis).toBe(15000);
  expect(config.max).toBe(5);
  expect(config.ssl).toBeUndefined();
});
test('individual database variables continue working locally', () => {
  expect(databaseConfig({DB_HOST:'localhost',DB_PORT:'5433',DB_NAME:'test',DB_USER:'developer'})).toMatchObject({host:'localhost',port:5433,database:'test',user:'developer'});
});
test('Render URLs replace localhost across links, QR codes and bio pages', () => {
  expect(getBaseUrl({RENDER_EXTERNAL_URL:'https://linkforge.onrender.com/'})).toBe('https://linkforge.onrender.com');
});
test('custom domain overrides Render default without duplicate slashes', () => {
  expect(getBaseUrl({BASE_URL:'https://links.example.com/',RENDER_EXTERNAL_URL:'https://linkforge.onrender.com'})).toBe('https://links.example.com');
  expect(getBaseUrl({PORT:'3087'})).toBe('http://localhost:3087');
});
