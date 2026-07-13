const Redis = require('ioredis');

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  lazyConnect: true,
  maxRetriesPerRequest: 1,
  enableOfflineQueue: false, // don't queue commands when Redis is down — fail fast
});

redis.on('connect', () => console.log('✅ Redis connected'));
redis.on('error',   (err) => console.error('⚠️  Redis error (non-fatal):', err.message));

// ── Key namespacing ───────────────────────────────────────────
// All keys are prefixed so they're easy to identify in Redis CLI
// and won't collide if we ever share a Redis instance
const KEYS = {
  slug:    (slug) => `snap:slug:${slug}`,      // slug → long_url
  user:    (id)   => `snap:user:${id}`,         // user session cache (Day 12)
  stats:   (slug) => `snap:stats:${slug}`,      // analytics cache (Day 10)
};

// TTLs in seconds — centralised so they're easy to tune
const TTL = {
  SLUG:  60 * 60,       // 1 hour  — redirect cache
  USER:  60 * 15,       // 15 mins — user session
  STATS: 60 * 5,        // 5 mins  — analytics (can be slightly stale)
};

// ── Simple in-memory metrics ──────────────────────────────────
// Lets you see hit/miss ratio at GET /api/cache/stats (wired below)
const metrics = { hits: 0, misses: 0, errors: 0 };

// ── Core operations ───────────────────────────────────────────

async function get(key) {
  try {
    const val = await redis.get(key);
    if (val !== null) {
      metrics.hits++;
    } else {
      metrics.misses++;
    }
    return val;
  } catch {
    metrics.errors++;
    return null; // degrade gracefully — caller treats as cache miss
  }
}

async function set(key, value, ttlSeconds = TTL.SLUG) {
  try {
    // 'EX' sets expiry in seconds — key auto-deletes after TTL
    await redis.set(key, value, 'EX', ttlSeconds);
  } catch {
    // non-fatal — app works without cache, just slower
  }
}

async function del(key) {
  try {
    await redis.del(key);
  } catch { /* ignore */ }
}

// Delete multiple keys at once — used when a user deletes all their links
async function delMany(keys) {
  if (!keys.length) return;
  try {
    await redis.del(...keys);
  } catch { /* ignore */ }
}

// ── Slug-specific helpers ─────────────────────────────────────
// Controllers use these instead of raw get/set/del
// so the key format is always consistent

async function getSlug(slug) {
  return get(KEYS.slug(slug));
}

async function setSlug(slug, longUrl) {
  return set(KEYS.slug(slug), longUrl, TTL.SLUG);
}

// Called when a URL is updated or deleted — prevents stale cache
async function invalidateSlug(slug) {
  return del(KEYS.slug(slug));
}

// ── Cache health + metrics ────────────────────────────────────
async function getMetrics() {
  const total = metrics.hits + metrics.misses;
  const hitRate = total > 0 ? ((metrics.hits / total) * 100).toFixed(1) : '0.0';
  let redisInfo = null;
  try {
    // redis INFO returns server stats — we just grab memory usage
    const info = await redis.info('memory');
    const memMatch = info.match(/used_memory_human:(\S+)/);
    redisInfo = { memoryUsed: memMatch?.[1] || 'unknown' };
  } catch { /* redis might be down */ }

  return {
    hits:    metrics.hits,
    misses:  metrics.misses,
    errors:  metrics.errors,
    hitRate: `${hitRate}%`,
    redis:   redisInfo,
  };
}

module.exports = {
  get, set, del, delMany,
  getSlug, setSlug, invalidateSlug,
  getMetrics,
  KEYS, TTL,
  redis,
};