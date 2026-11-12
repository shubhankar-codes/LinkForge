// Keep URL TLS parameters intact: Neon provides sslmode and channel_binding.
function databaseConfig(env = process.env) {
  const config = {
    max: 5,
    connectionTimeoutMillis: 15000,
    idleTimeoutMillis: 30000,
    enableChannelBinding: true,
  };
  if (env.DATABASE_URL) return { ...config, connectionString: env.DATABASE_URL };
  return { ...config,
    host: env.DB_HOST || 'localhost', port: Number(env.DB_PORT) || 5432,
    database: env.DB_NAME || 'linkforge', user: env.DB_USER || env.USER,
    password: env.DB_PASSWORD || '',
  };
}
module.exports = { databaseConfig };
