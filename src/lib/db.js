const { Pool } = require('pg');
require('dotenv').config();
const pool = new Pool(process.env.DATABASE_URL ? { connectionString: process.env.DATABASE_URL } : {
  host: process.env.DB_HOST || 'localhost', port: Number(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME || 'linkforge', user: process.env.DB_USER || process.env.USER,
  password: process.env.DB_PASSWORD || '', connectionTimeoutMillis: 2000,
});
pool.on('error', err => console.error('Database pool error:', err.message));
module.exports = { query: (text, params) => pool.query(text, params), pool };
