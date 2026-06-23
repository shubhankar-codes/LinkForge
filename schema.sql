-- ============================================================
-- SnapURL — Database Schema
-- Run once to set up the database:
--   psql -U postgres -c "CREATE DATABASE snapurl;"
--   psql -U postgres -d snapurl -f schema.sql
-- ============================================================

DROP TABLE IF EXISTS bio_links CASCADE;
DROP TABLE IF EXISTS bio_pages CASCADE;
DROP TABLE IF EXISTS clicks CASCADE;
DROP TABLE IF EXISTS urls CASCADE;
DROP TABLE IF EXISTS users CASCADE;
-- ── USERS ────────────────────────────────────────────────────
-- Accounts are optional — anonymous links have user_id = NULL
CREATE TABLE users (
  id            SERIAL PRIMARY KEY,
  email         VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,         -- bcrypt hash, never plain text
  created_at    TIMESTAMPTZ  DEFAULT NOW(),

  CONSTRAINT users_email_unique UNIQUE (email)
);


-- ── URLS ─────────────────────────────────────────────────────
-- Core table. One row = one short link.
CREATE TABLE urls (
  id            SERIAL PRIMARY KEY,
  slug          VARCHAR(10)  NOT NULL,          -- base62-encoded id, e.g. "4aB9x"
  long_url      TEXT         NOT NULL,          -- TEXT not VARCHAR — URLs can be very long
  user_id       INTEGER      REFERENCES users(id) ON DELETE SET NULL,  -- nullable for anon links

  -- stats
  click_count   INTEGER      NOT NULL DEFAULT 0, -- fast total; incremented on each hit

  -- optional expiry — NULL means never expires
  expires_at    TIMESTAMPTZ,

  -- open graph overrides — NULL means inherit from destination page
  og_title      VARCHAR(100),
  og_description VARCHAR(200),
  og_image      TEXT,

  -- conditional redirect rules stored as JSON array
  -- e.g. [{"type":"country","match":"IN","destination":"https://india.example.com"}]
  -- NULL means no rules — just redirect to long_url
  rules         JSONB        DEFAULT '[]'::jsonb,

  created_at    TIMESTAMPTZ  DEFAULT NOW(),

  CONSTRAINT urls_slug_unique UNIQUE (slug)
);


-- ── CLICKS ───────────────────────────────────────────────────
-- One row per redirect hit. Powers all analytics.
-- This table will grow fast — indexes matter a lot here.
CREATE TABLE clicks (
  id          SERIAL PRIMARY KEY,
  url_id      INTEGER     NOT NULL REFERENCES urls(id) ON DELETE CASCADE, -- delete clicks if URL deleted

  -- geo + device (parsed at request time, not stored raw)
  country     VARCHAR(2),                       -- ISO country code: "IN", "US", "GB"
  device      VARCHAR(20),                      -- "mobile" | "tablet" | "desktop" | "unknown"
  browser     VARCHAR(30),                      -- "chrome" | "firefox" | "safari" | "edge" | "other"
  referrer    TEXT,                             -- where the click came from (can be NULL for direct)

  -- hashed IP for privacy (GDPR) — SHA-256 of ip + daily salt
  ip_hash     VARCHAR(64),

  created_at  TIMESTAMPTZ DEFAULT NOW()
);


-- ── BIO PAGES ────────────────────────────────────────────────
-- Link-in-bio feature. One user → one bio page → many bio links.
CREATE TABLE bio_pages (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  username    VARCHAR(30)  NOT NULL,            -- becomes /b/username
  title       VARCHAR(100),
  bio         TEXT,
  created_at  TIMESTAMPTZ  DEFAULT NOW(),

  CONSTRAINT bio_pages_username_unique UNIQUE (username)
);

-- Links inside a bio page
CREATE TABLE bio_links (
  id          SERIAL PRIMARY KEY,
  bio_page_id INTEGER      NOT NULL REFERENCES bio_pages(id) ON DELETE CASCADE,
  label       VARCHAR(100) NOT NULL,            -- "My Portfolio", "Twitter", etc.
  url         TEXT         NOT NULL,
  position    SMALLINT     NOT NULL DEFAULT 0,  -- display order
  created_at  TIMESTAMPTZ  DEFAULT NOW()
);


-- ============================================================
-- INDEXES
-- Every index answers a specific query. Read the comment to
-- understand which query each one is optimising.
-- ============================================================

-- The most critical index in the whole app.
-- Every redirect does: SELECT * FROM urls WHERE slug = $1
-- Without this, that's a full table scan on every single click.
CREATE UNIQUE INDEX idx_urls_slug
  ON urls(slug);

-- Dashboard: "show me all links for this user, newest first"
-- SELECT * FROM urls WHERE user_id = $1 ORDER BY created_at DESC
CREATE INDEX idx_urls_user_id
  ON urls(user_id);

-- Analytics: "show me all clicks for this URL, newest first"
-- Also covers time-range queries like "clicks in the last 7 days"
CREATE INDEX idx_clicks_url_id_created
  ON clicks(url_id, created_at DESC);

-- Analytics: "clicks by country for url_id X"
-- SELECT country, COUNT(*) FROM clicks WHERE url_id = $1 GROUP BY country
CREATE INDEX idx_clicks_url_id_country
  ON clicks(url_id, country);

-- Analytics: "clicks by device for url_id X"
CREATE INDEX idx_clicks_url_id_device
  ON clicks(url_id, device);

-- Bio page lookup: /b/:username
-- SELECT * FROM bio_pages WHERE username = $1
CREATE UNIQUE INDEX idx_bio_pages_username
  ON bio_pages(username);


-- ============================================================
-- SEED DATA (for local development only)
-- Gives you something to work with immediately
-- ============================================================

-- A test user (password is "password123" — bcrypt hash)
INSERT INTO users (email, password_hash)
VALUES ('test@example.com', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi');

-- A test short URL linked to that user
-- slug "test01" → id 1 → we'll encode properly once base62 is built on Day 4
INSERT INTO urls (slug, long_url, user_id, click_count)
VALUES ('test01', 'https://github.com', 1, 0);

-- A few fake clicks so your analytics dashboard isn't empty
INSERT INTO clicks (url_id, country, device, browser, referrer)
VALUES
  (1, 'IN', 'mobile',  'chrome',  'https://twitter.com'),
  (1, 'US', 'desktop', 'chrome',  'https://google.com'),
  (1, 'IN', 'mobile',  'safari',  NULL),
  (1, 'GB', 'desktop', 'firefox', 'https://reddit.com'),
  (1, 'IN', 'tablet',  'chrome',  'https://whatsapp.com');


