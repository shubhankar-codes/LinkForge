# Architecture & Theory

This document explains the core concepts behind how SnapURL works. Read this before writing any code — understanding _why_ helps you make better decisions throughout the build.

---

## 1. What Actually Happens When You Visit a Short URL

When someone clicks `https://snap.url/abc123`, here is the exact sequence:

```
1. Browser does DNS lookup for snap.url
2. TCP handshake with our server (SYN → SYN-ACK → ACK)
3. TLS handshake (for HTTPS)
4. Browser sends:   GET /abc123 HTTP/1.1
5. Our server looks up abc123 in Redis (cache)
6. If cache miss → look up in PostgreSQL database
7. Server responds: HTTP/1.1 302 Found
                    Location: https://original-long-url.com/page
8. Browser immediately follows the Location header
9. Browser loads the destination site
```

The user experiences this as near-instant. Our job is to make steps 4–7 as fast as possible.

---

## 2. HTTP 301 vs 302 — A Critical Decision

Both tell the browser "go somewhere else", but they behave differently.

### 301 Permanent Redirect

```
HTTP/1.1 301 Moved Permanently
Location: https://destination.com
```

- Browser **caches this forever** (or until cache expires)
- On subsequent visits, the browser goes **directly to the destination** — it never contacts our server again
- **Problem for us:** We can't track repeat visits from the same browser. We also can't update the destination after the browser has cached it.

### 302 Temporary Redirect (what we use)

```
HTTP/1.1 302 Found
Location: https://destination.com
```

- Browser **does not cache** this
- Every single click comes through our server
- We can track every visit, and we can change the destination at any time
- Tiny extra latency (one extra network hop) — acceptable trade-off

**Decision: Always use 302.** The analytics and flexibility are worth it.

---

## 3. Slug Generation — The Math Behind Short Codes

A "slug" is the short code in our URL. For `snap.url/abc123`, the slug is `abc123`.

### Why Base62?

Base62 uses 62 characters: `a-z` (26) + `A-Z` (26) + `0-9` (10).

We avoid characters like `0`, `O`, `1`, `l` that look similar... actually we include all of them for maximum density. The user doesn't type slugs by hand.

### How Many Slugs Can We Make?

| Length | Combinations         |
|--------|----------------------|
| 4 chars | 62⁴ = 14,776,336   |
| 6 chars | 62⁶ = 56,800,235,584 |
| 7 chars | 62⁷ = 3.5 trillion  |

6 characters gives us 56 billion unique slugs. More than enough.

### The Auto-Increment Strategy

This is the cleanest approach:

```
1. Insert new URL row into database
2. Database auto-assigns an integer ID (e.g. 1, 2, 3, 12345...)
3. Convert that integer to base62
4. That base62 string IS the slug
```

No collision possible because every row gets a unique integer ID.

```
ID 1      → "1"       (base62)
ID 62     → "z"
ID 63     → "10"
ID 3844   → "100"     (62² = 3844)
ID 100000 → "q0u"
```

### The Conversion Algorithm

```javascript
const CHARS = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';

function toBase62(num) {
  if (num === 0) return CHARS[0];
  let result = '';
  while (num > 0) {
    result = CHARS[num % 62] + result;
    num = Math.floor(num / 62);
  }
  return result;
}

// toBase62(1)      → "1"
// toBase62(62)     → "a"    ← wait, let's trace this:
//   62 % 62 = 0   → CHARS[0] = '0', num = 1
//   1  % 62 = 1   → CHARS[1] = '1', num = 0
//   result = "10"           ← correct, this is 62 in base62
```

---

## 4. Database Design — Why PostgreSQL

### Why Not MongoDB or Redis Alone?

- We need **relational queries** — "give me all clicks for user X's links in the last 7 days grouped by country"
- MongoDB can do this, but SQL is more natural and better optimised for aggregation
- Redis is fast but not designed for complex queries or durable storage of large datasets

### Core Tables (Preview)

```sql
-- Every shortened URL lives here
urls (
  id          SERIAL PRIMARY KEY,   -- auto-increment integer
  slug        VARCHAR(10) UNIQUE,   -- the base62 short code
  long_url    TEXT NOT NULL,        -- where it redirects to
  user_id     INTEGER,              -- nullable for anonymous links
  created_at  TIMESTAMPTZ,
  expires_at  TIMESTAMPTZ           -- optional expiry
)

-- Every click on any link
clicks (
  id          SERIAL PRIMARY KEY,
  url_id      INTEGER REFERENCES urls(id),
  country     VARCHAR(2),           -- "IN", "US", "GB" etc.
  device      VARCHAR(20),          -- "mobile", "desktop", "tablet"
  referrer    TEXT,
  created_at  TIMESTAMPTZ
)
```

### Why Indexes Matter

Without an index on `slug`, looking up `abc123` requires scanning every row in the table. With a B-Tree index, it's `O(log n)` — instant even with millions of rows.

```sql
CREATE UNIQUE INDEX idx_urls_slug ON urls(slug);
-- This makes GET /:slug fast at any scale
```

---

## 5. Caching with Redis

### The Problem

If our most popular link gets 1,000 clicks per second, we're running 1,000 database queries per second just for that one slug. Postgres can handle this, but it's wasteful.

### The Solution

```
Request comes in for /abc123
        │
        ▼
   Redis cache?  ──── HIT ────► Return long_url (0.1ms)
        │
       MISS
        │
        ▼
  PostgreSQL query               (2-5ms)
        │
        ▼
  Store in Redis with 1hr TTL
        │
        ▼
  Return long_url
```

### Cache Invalidation

TTL (time-to-live) of 1 hour means the cache entry expires automatically. If a user updates their link's destination, the old cache entry will be stale for up to 1 hour — acceptable for our use case.

For immediate updates, we can delete the Redis key when the URL is updated.

---

## 6. Async Analytics — Don't Slow Down the Redirect

This is an important architecture decision.

### Wrong approach (slow):

```
Request → Look up slug → Log analytics → Send redirect
                              ↑
                         This adds 5-10ms to every redirect
```

### Right approach (fast):

```
Request → Look up slug → Send redirect     ← user is gone in <50ms
                    └──► Log analytics    ← happens after, doesn't affect user
```

In Node.js, we can do this because the event loop continues running after we send the response. We fire the analytics write and immediately send the redirect — the write finishes in the background.

---

## 7. Rate Limiting — Protecting the API

Without rate limiting, someone can write a script that calls `/api/shorten` millions of times, filling our database with junk.

### Token Bucket Algorithm

Each IP gets a "bucket" of tokens (e.g. 10 tokens). Each API call consumes one token. Tokens refill at a fixed rate (e.g. 10 per minute). When the bucket is empty, the request gets a `429 Too Many Requests` response.

We'll use the `express-rate-limit` package which handles all of this for us.

---

## 8. The Full System Architecture

```
                    ┌─────────────┐
                    │   Browser   │
                    └──────┬──────┘
                           │ GET /abc123
                    ┌──────▼──────┐
                    │ Load Balancer│  (in production)
                    └──────┬──────┘
                           │
                    ┌──────▼──────┐
                    │  Express API │
                    │   (Node.js)  │
                    └──┬──────┬───┘
                       │      │
              ┌────────▼─┐  ┌─▼────────┐
              │  Redis   │  │ PostgreSQL│
              │  Cache   │  │ Database │
              └──────────┘  └──────────┘
                                  │
                         ┌────────▼────────┐
                         │ Async Analytics │
                         │  (clicks table) │
                         └─────────────────┘
```

---

## 9. Security Considerations

### URL Validation
We must validate that the submitted URL is actually a valid URL before shortening it. We use the `validator` npm package for this.

We also need to block:
- `javascript:` URLs (XSS vector)
- `data:` URLs
- Private IP ranges (SSRF protection — prevents someone from shortening `http://192.168.1.1/admin`)

### SQL Injection
Always use parameterised queries. Never concatenate user input into SQL strings.

```javascript
// WRONG — never do this
db.query(`SELECT * FROM urls WHERE slug = '${slug}'`);

// RIGHT — parameterised
db.query('SELECT * FROM urls WHERE slug = $1', [slug]);
```

### Open Redirects
We only allow redirects to external URLs (not back to our own server). This prevents redirect chains that could be used for phishing.

---

## 10. Performance Targets

| Operation          | Target latency |
|--------------------|----------------|
| Redirect (cached)  | < 10ms         |
| Redirect (uncached)| < 50ms         |
| Shorten URL        | < 100ms        |
| Analytics query    | < 500ms        |

---

_This document will be updated as new features are added throughout the 21-day build._
