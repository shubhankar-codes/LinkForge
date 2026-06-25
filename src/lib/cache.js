const Redis = require("ioredis");

const redis = new Redis(
  process.env.REDIS_URL || "redis://localhost:6379",
  {
    lazyConnect: false,
    maxRetriesPerRequest: 1,
  }
);

redis.on("connect", () => {
  console.log("✅ Redis connected");
});

redis.on("error", (err) => {
  console.warn("⚠️ Redis connection failed:", err.message);
});

async function get(key) {
  try {
    return await redis.get(key);
  } catch {
    return null;
  }
}

async function set(key, value, ttlSeconds = 3600) {
  try {
    await redis.set(key, value, "EX", ttlSeconds);
  } catch {}
}

async function del(key) {
  try {
    await redis.del(key);
  } catch {}
}

module.exports = {
  get,
  set,
  del,
  redis,
};