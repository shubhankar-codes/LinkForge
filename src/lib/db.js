const { Pool } = require("pg");
require("dotenv").config();

const pool = new Pool({
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME || "linkforge",
  user: process.env.DB_USER || "shubhankarmishra",
  password: process.env.DB_PASSWORD || "",
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Test the connection when the server starts
pool
  .connect()
  .then((client) => {
    console.log("✅ Database connected");
    client.release();
  })
  .catch((err) => {
    console.error("❌ Database connection failed");
    console.error(err);
    process.exit(1);
  });

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
};