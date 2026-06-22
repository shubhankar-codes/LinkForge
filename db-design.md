# Database Design

This document explains every table, column, and index decision.  
The actual SQL is in `schema.sql` at the root of the project.

---

## Why PostgreSQL?

We need:
1. **ACID transactions** — when we insert a URL and return the slug, it must be atomic
2. **Complex aggregation** — analytics queries like "clicks per country per day for a slug"
3. **Relational integrity** — `clicks` must reference valid `urls` rows
4. **Durable storage** — data survives restarts (unlike Redis)

PostgreSQL handles all of this excellently.

---

## Tables Overview

```
users ──────────────────────────────────────────────────────────────
  id, email, password_hash, created_at

urls ───────────────────────────────────────────────────────────────
  id, slug, long_url, user_id → users.id, created_at, expires_at,
  click_count, custom_og_title, custom_og_description, custom_og_image,
  rules (JSONB)

clicks ─────────────────────────────────────────────────────────────
  id, url_id → urls.id, ip_hash, country, device, browser,
  referrer, created_at

bio_pages ──────────────────────────────────────────────────────────
  id, user_id → users.id, username, title, bio, created_at

bio_links ──────────────────────────────────────────────────────────
  id, bio_page_id → bio_pages.id, label, url, position
```

---

## Table: `urls`

The heart of the system. Every shortened link is one row here.

### Column decisions

**`id SERIAL PRIMARY KEY`**
Auto-incrementing integer. This integer is what we encode to base62 to create the slug. Starting at 1, so the first slug is `"1"` (or we can pad to 6 chars with leading chars if we want consistent length).

**`slug VARCHAR(10) UNIQUE NOT NULL`**
We store the slug explicitly even though it's derivable from the ID. Why? It's simpler to query, and it lets us support custom slugs (user-chosen) that don't follow the base62 pattern.

**`long_url TEXT NOT NULL`**
Text, not VARCHAR with a limit. URLs can be very long (2,000+ characters for some Google Maps links). TEXT handles any length.

**`user_id INTEGER REFERENCES users(id) ON DELETE SET NULL`**
Nullable. Anonymous links (no account required) have `user_id = NULL`. If a user deletes their account, we set this to NULL rather than deleting the link — the link keeps working.

**`click_count INTEGER DEFAULT 0`**
A denormalised counter we increment on each click. Much faster to query "total clicks" than `SELECT COUNT(*) FROM clicks WHERE url_id = ?` on a large clicks table. We keep both: the counter for fast display, and the clicks table for analytics detail.

**`expires_at TIMESTAMPTZ`**
Nullable. If set, the redirect returns a 410 Gone after this timestamp instead of redirecting.

**`rules JSONB`**
A flexible JSON column for conditional redirect rules. Example:
```json
[
  { "type": "country", "match": "IN", "destination": "https://india.example.com" },
  { "type": "device",  "match": "mobile", "destination": "https://app.example.com/download" }
]
```
Rules are evaluated in order. First match wins. If no rule matches, use `long_url`.

---

## Table: `clicks`

One row per click on any short link.

**`ip_hash VARCHAR(64)`**
We store a hashed version of the IP, not the raw IP. This is better for privacy (GDPR compliance) and still lets us do approximate unique visitor counting.

**`country VARCHAR(2)`**
ISO 3166-1 alpha-2 country code. "IN" for India, "US" for United States, etc. We look this up from the IP using a free geolocation API.

**`device VARCHAR(20)`**
One of: `"mobile"`, `"tablet"`, `"desktop"`, `"unknown"`. Parsed from the User-Agent header.

**`browser VARCHAR(30)`**
One of: `"chrome"`, `"firefox"`, `"safari"`, `"edge"`, `"other"`.

**`referrer TEXT`**
The `Referer` header from the browser. Tells us if the click came from Twitter, WhatsApp, a website, etc. Nullable — direct visits have no referrer.

---

## Indexes

```sql
-- Primary lookup for redirects — must be as fast as possible
CREATE UNIQUE INDEX idx_urls_slug ON urls(slug);

-- User's link list on dashboard
CREATE INDEX idx_urls_user_id ON urls(user_id);

-- Analytics queries filtering by URL and time range
CREATE INDEX idx_clicks_url_id_created ON clicks(url_id, created_at DESC);

-- Bio pages lookup by username
CREATE UNIQUE INDEX idx_bio_pages_username ON bio_pages(username);
```

### Why these indexes?

The `idx_urls_slug` index is the most critical. Every single redirect (which is 99% of our traffic) does:
```sql
SELECT long_url, rules, expires_at FROM urls WHERE slug = $1
```
Without the index: full table scan = O(n). With B-Tree index: O(log n). At 10 million rows, that's the difference between scanning 10,000,000 rows vs ~23 comparisons.

---

## Slug Strategy: Auto-increment + Base62

```
New URL inserted
      ↓
PostgreSQL assigns id = 10542
      ↓
toBase62(10542) → "2oG"
      ↓
UPDATE urls SET slug = '2oG' WHERE id = 10542
```

Alternative: generate slug first, then insert with it. Either works. We'll use the INSERT-then-UPDATE approach because it keeps the insert simple and avoids needing to generate and validate a slug before inserting.

---

## Why Not MongoDB?

MongoDB is a fine choice, but for this project:
- Aggregation pipelines are more verbose than SQL GROUP BY
- JOIN equivalents ($lookup) are less performant for relational data
- We lose foreign key constraints, so we'd have to validate relationships in code
- PostgreSQL's JSONB gives us flexible schema where we need it (the `rules` column), so we get the best of both worlds
