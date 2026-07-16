# ─── Postie One-Click Deploy Script ──────────────────────────────────────────
# Builds dashboard, deploys worker, publishes static assets to Cloudflare Pages.

$ErrorActionPreference = "Stop"

Write-Host "🚀 Postie Deploy Starting..." -ForegroundColor Yellow

# Step 1: Install dependencies
Write-Host "`n📦 Installing dependencies..." -ForegroundColor Cyan
Push-Location worker
npm install
Pop-Location

Push-Location dashboard
npm install
Pop-Location

# Step 2: Build dashboard
Write-Host "`n🏗️  Building dashboard..." -ForegroundColor Cyan
Push-Location dashboard
npm run build
Pop-Location

# Step 3: Deploy worker
Write-Host "`n☁️  Deploying worker..." -ForegroundColor Cyan
Push-Location worker
wrangler deploy
Pop-Location

# Step 4: Deploy dashboard to Pages
Write-Host "`n📄 Deploying dashboard to Cloudflare Pages..." -ForegroundColor Cyan
wrangler pages deploy dashboard/dist --project-name postie-dashboard --branch production

Write-Host "`n✅ Postie Deploy Complete!" -ForegroundColor Green
