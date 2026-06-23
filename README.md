# LINKFORGE — A Modern URL Shortener

> Shorten links. Track clicks. Control where people go.

LinkForge is a production-grade URL shortener built from scratch. Beyond basic shortening, it features deep click analytics, conditional redirects (by country/device), QR code generation, custom slugs, and link-in-bio pages.

---

## Live Demo

> _Coming in Day 20 — deploy link will go here_

---

## Features

- **Instant shortening** — paste a URL, get a short link in under 100ms
- **Click analytics** — track clicks by country, device, referrer, and time
- **Conditional redirects** — same short link, different destination based on device or country
- **Custom slugs** — choose your own `/my-brand` instead of a random code
- **QR codes** — auto-generated for every short link
- **Link-in-bio** — one URL that opens a mini landing page with multiple links
- **Open Graph control** — custom title, description, and image per link
- **Rate limiting** — protect the API from abuse
- **Redis caching** — hot links resolve in sub-millisecond time

---

## Tech Stack

| Layer      | Technology              |
|------------|-------------------------|
| API        | Node.js + Express       |
| Database   | PostgreSQL               |
| Cache      | Redis                   |
| Frontend   | Next.js + Tailwind CSS  |
| Auth       | JWT (JSON Web Tokens)   |
| Deploy     | Railway + Vercel        |

---

## Project Structure

```
url-shortener/
├── src/                    # Backend API
│   ├── app.js              # Express app entry point
│   ├── routes/             # Route definitions
│   ├── controllers/        # Business logic
│   ├── models/             # Database queries
│   ├── middleware/         # Auth, rate limiting, errors
│   ├── services/           # Analytics, rules engine
│   ├── utils/              # Slug generator, validators
│   └── lib/                # Redis, DB connection pool
├── frontend/               # Next.js frontend
│   ├── pages/              # App pages
│   └── components/         # React components
├── docs/                   # Architecture and design docs
├── tests/                  # Unit and integration tests
├── schema.sql              # Database schema
└── .env.example            # Environment variable template
```

---

## Getting Started (Local Development)

### Prerequisites

- Node.js v18+
- PostgreSQL 15+
- Redis 7+

### 1. Clone the repository

```bash
git clone https://github.com/YOUR_USERNAME/url-shortener.git
cd url-shortener
```

### 2. Install dependencies

```bash
npm install
```

### 3. Set up environment variables

```bash
cp .env.example .env
# Edit .env with your database credentials and secrets
```

### 4. Set up the database

```bash
psql -U postgres -f schema.sql
```

### 5. Start development server

```bash
npm run dev
```

API will be running at `http://localhost:3000`

---

## API Reference

| Method | Endpoint              | Description                    |
|--------|-----------------------|--------------------------------|
| POST   | `/api/shorten`        | Create a short URL             |
| GET    | `/:slug`              | Redirect to original URL       |
| GET    | `/api/stats/:slug`    | Get click analytics for a link |
| GET    | `/api/qr/:slug`       | Get QR code for a short link   |
| POST   | `/auth/register`      | Register a new user            |
| POST   | `/auth/login`         | Login and receive JWT          |

---

## Daily Build Log

This project was built in 21 days. Each day's progress is documented below.

| Day | Feature | Status |
|-----|---------|--------|
| 1   | Core theory + project scaffold | ✅ |
| 2   | Database schema design | ✅ |
| 3   | Express app scaffold | 🔲 |
| 4   | Slug generation (base62) | 🔲 |
| 5   | POST /api/shorten endpoint | 🔲 |
| 6   | GET /:slug redirect | 🔲 |
| 7   | Redis caching layer | 🔲 |
| 8   | Rate limiting + error handling | 🔲 |
| 9   | Click tracking + analytics | 🔲 |
| 10  | Analytics API | 🔲 |
| 11  | Rules engine (geo/device redirects) | 🔲 |
| 12  | JWT authentication | 🔲 |
| 13  | Next.js frontend scaffold | 🔲 |
| 14  | Shorten UI | 🔲 |
| 15  | Analytics dashboard | 🔲 |
| 16  | QR code generation | 🔲 |
| 17  | Custom slugs | 🔲 |
| 18  | Link-in-bio pages | 🔲 |
| 19  | Open Graph preview control | 🔲 |
| 20  | Production deployment | 🔲 |
| 21  | Polish + v1.0.0 release | 🔲 |

---

## Contributing

This is a personal learning project, but PRs and issues are welcome!

---

## License

MIT
