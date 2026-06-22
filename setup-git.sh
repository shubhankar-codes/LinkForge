#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# Day 1 Git Setup Script
# Run this ONCE to initialise your repo and make your first commit
# ─────────────────────────────────────────────────────────────

set -e  # exit on any error

echo "🚀 Setting up SnapURL git repository..."

# 1. Initialise git
git init
echo "✅ Git initialised"

# 2. Set your details (edit these)
git config user.name "Your Name"
git config user.email "your@email.com"

# 3. Stage all Day 1 files
git add README.md
git add .gitignore
git add .env.example
git add package.json
git add docs/ARCHITECTURE.md
git add docs/db-design.md

# 4. First commit
git commit -m "chore: initial project scaffold + architecture notes

Day 1 complete:
- Project README with full feature list and build log
- Architecture document covering HTTP redirects, base62 slugs,
  caching strategy, async analytics, and security considerations
- Database design document with table decisions and index strategy
- .gitignore, package.json, .env.example scaffolded
- 21-day build plan documented"

echo "✅ First commit made"
echo ""
echo "─────────────────────────────────────────────────────────────"
echo "Next steps to push to GitHub:"
echo ""
echo "1. Go to https://github.com/new"
echo "2. Create a new repo called 'url-shortener' (make it public!)"
echo "3. DO NOT add README or .gitignore — we already have them"
echo "4. Copy the repo URL and run:"
echo ""
echo "   git remote add origin https://github.com/YOUR_USERNAME/url-shortener.git"
echo "   git branch -M main"
echo "   git push -u origin main"
echo ""
echo "─────────────────────────────────────────────────────────────"
echo "✅ Day 1 done! Tomorrow: Database schema (schema.sql)"
