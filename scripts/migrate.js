require('dotenv').config();
const fs = require('fs');
const path = require('path');
// Use a direct Neon session for DDL and the migration advisory lock.
if (process.env.DATABASE_URL_UNPOOLED) {
  const { databaseConfig, validateConnectionString } = require('../src/lib/dbConfig');
  databaseConfig();
  validateConnectionString(process.env.DATABASE_URL_UNPOOLED, 'DATABASE_URL_UNPOOLED');
  process.env.DATABASE_URL = process.env.DATABASE_URL_UNPOOLED;
}
const db = require('../src/lib/db');
(async () => {
  let client;
  let locked = false;
  try {
    client = await db.pool.connect();
    await client.query('SELECT pg_advisory_lock(62193495)');
    locked = true;
    const exists = await client.query("SELECT to_regclass('public.urls') AS name");
    if (!exists.rows[0].name) await client.query(fs.readFileSync(path.join(__dirname, '../schema.sql'), 'utf8'));
    const directory = path.join(__dirname, '../migrations');
    for (const file of fs.readdirSync(directory).filter(f => f.endsWith('.sql')).sort()) {
      await client.query(fs.readFileSync(path.join(directory, file), 'utf8'));
    }
    console.log('Database ready; existing data preserved.');
  } catch (err) {
    if (client) await client.query('ROLLBACK').catch(() => {});
    // Do not print connection strings or credentials from driver error details.
    console.error('Database migration failed:', err.code || 'connection/schema error');
    process.exitCode = 1;
  } finally {
    if (locked) await client.query('SELECT pg_advisory_unlock(62193495)').catch(() => {});
    client?.release();
    await db.pool.end();
  }
})();
