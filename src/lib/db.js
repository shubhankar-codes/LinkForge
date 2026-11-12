const { Pool } = require('pg');
require('dotenv').config();
const { databaseConfig } = require('./dbConfig');
const pool = new Pool(databaseConfig());
pool.on('error', err => console.error('Database pool error:', err.message));
module.exports = { query: (text, params) => pool.query(text, params), pool };
