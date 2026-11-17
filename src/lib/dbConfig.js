function validateConnectionString(value, key) {
  const url = /^postgres(?:ql)?:\/\//.test(value) && URL.canParse(value)
    ? new URL(value)
    : null;
  if (!url?.hostname || url.hostname === 'base' || /[\s'"]/.test(value)) {
    throw new Error(`${key} must contain only the PostgreSQL URL. Copy it from Neon Connect without psql, an assignment, or quotes.`);
  }
}

// Keep URL TLS parameters intact: Neon provides sslmode and channel_binding.
function databaseConfig(env = process.env) {
  const config = {
    max: 5,
    connectionTimeoutMillis: 15000,
    idleTimeoutMillis: 30000,
    enableChannelBinding: true,
  };
  if (env.DATABASE_URL) {
    validateConnectionString(env.DATABASE_URL, 'DATABASE_URL');
    return { ...config, connectionString: env.DATABASE_URL };
  }
  if (env.RENDER === 'true') throw new Error('Set DATABASE_URL to the pooled PostgreSQL URL in Render Environment.');
  return { ...config,
    host: env.DB_HOST || 'localhost', port: Number(env.DB_PORT) || 5432,
    database: env.DB_NAME || 'linkforge', user: env.DB_USER || env.USER,
    password: env.DB_PASSWORD || '',
  };
}
module.exports = { databaseConfig, validateConnectionString };
