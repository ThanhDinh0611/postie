# 📋 Postie — Implementation Plan & Tracker

> **Postie** — AI Facebook post generator & link creator. Cloudflare-native, React 18 + TypeScript, Vertical Slice Architecture.

---

## 🏗️ Architecture

```
postie/
├── worker/               # Cloudflare Worker (Hono + D1 + R2 + DeepSeek AI)
│   ├── src/
│   │   ├── index.ts              # Hono router, CORS, middleware
│   │   ├── core/
│   │   │   ├── auth.ts           # Clerk JWT verification + tier auth
│   │   │   ├── tiers.ts          # Tier capabilities config
│   │   │   ├── ai.ts             # DeepSeek AI client (copywriting)
│   │   │   └── facebook.ts       # Facebook Graph API client
│   │   └── features/             # Vertical Slices
│   │       ├── pages/            # Facebook Page management
│   │       ├── posts/            # AI post generation & publishing
│   │       ├── links/            # Post link generation & sharing
│   │       ├── media/            # Image upload → R2 bucket
│   │       └── billing/          # Subscription billing
│   ├── schema.sql          # D1 database schema
│   ├── migrations/         # SQL migrations
│   ├── wrangler.toml       # Worker config
│   ├── package.json
│   └── tsconfig.json
│
├── dashboard/             # React SPA (Vite + TypeScript + Clerk)
│   ├── src/
│   │   ├── App.tsx        # Router, layout, data loading
│   │   ├── api.ts         # Typed fetch API client
│   │   ├── main.tsx       # Entry point
│   │   ├── index.css      # Dark theme design system
│   │   ├── vite-env.d.ts  # Env type declarations
│   │   ├── components/    # Presentational components
│   │   ├── hooks/         # Custom hooks
│   │   └── utils/         # Utilities
│   ├── public/_redirects  # SPA fallback routing
│   ├── index.html
│   ├── package.json
│   ├── vite.config.ts
│   └── tsconfig.json
│
├── .clinerules            # React/TS coding standards
├── .gitignore
├── package.json           # Workspace scripts
├── deploy.ps1             # One-click deploy
└── PLAN.md                # This file
```

---

## ✅ Implementation Phases

### Phase 1: Foundation (Worker + DB + Auth)
- [x] **1.1** Create D1 database (`wrangler d1 create postie-db`)
- [x] **1.2** Apply schema to D1 (`wrangler d1 execute postie-db --file=./schema.sql`)
- [x] **1.3** Set up Clerk application (get publishable key + JWKS URL)
- [x] **1.4** Set up Facebook App (get App ID + App Secret)
- [x] **1.5** Configure `wrangler.toml` with D1, R2, and vars
- [x] **1.6** Create R2 bucket (`wrangler r2 bucket create postie-images`)
- [x] **1.7** Start worker dev — verify health check
- [x] **1.8** Test Clerk JWT verification via `core/auth.ts`
- [x] **1.9** Implement Facebook OAuth flow in `pages.handlers.ts`
- [x] **1.10** Create `.env.development` / `.env.production` for dashboard
- [x] **1.11** Start dashboard dev — verify Clerk login flow

### Phase 2: AI Post Generation (Core Feature)
- [ ] **2.1** Wire DeepSeek API key in worker vars
- [ ] **2.2** Build and test `core/ai.ts` — `generatePostContent()`
- [ ] **2.3** Test XML parsing + variant extraction in `parseResponse()`
- [ ] **2.4** Implement `POST /api/posts/generate` endpoint
- [ ] **2.5** Implement generation usage tracking
- [ ] **2.6** Build **PostGenerator** component (topic, hook, formula, tone, format)
- [ ] **2.7** Build **PostPreview** component (content with variant tabs)
- [ ] **2.8** Wire frontend → API → display generated post

### Phase 3: Publish + Links (Core Feature)
- [ ] **3.1** Implement `POST /api/posts/publish` endpoint
- [ ] **3.2** Implement `buildPermalink()` — Facebook URL construction
- [ ] **3.3** Implement photo post publishing
- [ ] **3.4** Implement scheduled publishing
- [ ] **3.5** Build **LinkResultCard** component (copy, open, clear cache)
- [ ] **3.6** Build publish flow: Generate → Preview → Publish → Show Link
- [ ] **3.7** Implement `POST /api/posts/:id/clear-cache`
- [ ] **3.8** E2E test: Generate → Publish → Get Link → Open on Facebook

### Phase 4: Dashboard & History
- [ ] **4.1** Build **LinksPage** — full list of published posts with links
- [ ] **4.2** Build **PagesPage** — connected Facebook pages management
- [ ] **4.3** Build page selection/activation flow
- [ ] **4.4** Build **ImageUploader** component (upload to R2, preview, attach)
- [ ] **4.5** Build **SocialPreview** — simulate how link looks on Facebook
- [ ] **4.6** Implement clipboard copy for permalinks
- [ ] **4.7** Add auto-refresh on navigation

### Phase 5: Reel Generation
- [ ] **5.1** Add Reel format to `core/ai.ts` — ultra-short caption (<80 chars)
- [ ] **5.2** Implement `POST /api/posts/generate-reel` endpoint
- [ ] **5.3** Build Reel-specific UI (duration selector, script preview)
- [ ] **5.4** Implement video script generation (segments + visual/voiceover)

### Phase 6: Billing & Polish
- [ ] **6.1** Implement VietQR payment generation
- [ ] **6.2** Implement payment webhook (SePay/Casso)
- [ ] **6.3** Add tier-based feature gating in UI
- [ ] **6.4** Build Billing/Upgrade page
- [ ] **6.5** Add error boundaries and loading states
- [ ] **6.6** Test full deployment via `deploy.ps1`
- [ ] **6.7** Performance audit — minimize Worker cold starts
- [ ] **6.8** Documentation — README with setup instructions

---

## 🎯 API Reference (Planned)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/health` | No | Health check |
| `POST` | `/api/pages/oauth` | Yes | Exchange OAuth code for page tokens |
| `GET` | `/api/pages` | Yes | List connected Facebook pages |
| `DELETE` | `/api/pages/:id` | Yes | Disconnect a Facebook page |
| `POST` | `/api/pages/:id/select` | Yes | Set active page |
| `POST` | `/api/posts/generate` | Yes | AI generate post content |
| `POST` | `/api/posts/publish` | Yes | Publish post to Facebook |
| `GET` | `/api/posts` | Yes | List user's posts |
| `POST` | `/api/posts/:id/clear-cache` | Yes | Clear Facebook/Zalo cache |
| `GET` | `/api/links` | Yes | List all generated permalinks |
| `GET` | `/api/links/:postId` | Yes | Get single link details |
| `POST` | `/api/media/upload` | Yes | Upload image to R2 |
| `GET` | `/api/media` | Yes | List user's uploaded images |
| `GET` | `/api/billing/status` | Yes | Get subscription status |

---

## 🔑 Environment Variables

### Worker (`wrangler.toml`)
| Variable | Description |
|----------|-------------|
| `DB` | D1 database binding |
| `IMAGES` | R2 bucket binding |
| `ALLOWED_ORIGINS` | CORS allowed origins |
| `CLERK_JWKS_URL` | Clerk JWKS URL for JWT verification |
| `DEEPSEEK_API_KEY` | DeepSeek API key for AI generation |
| `FACEBOOK_APP_ID` | Facebook App ID for OAuth |
| `FACEBOOK_APP_SECRET` | Facebook App Secret |
| `R2_PUBLIC_URL` | Public R2 bucket URL |

### Dashboard (`.env`)
| Variable | Description |
|----------|-------------|
| `VITE_API_URL` | Worker API base URL |
| `VITE_CLERK_PUBLISHABLE_KEY` | Clerk publishable key |

---

## 📈 Progress

| Phase | Status | Started | Completed |
|-------|--------|---------|-----------|
| **P1: Foundation** | 🟢 Completed | 2026-07-16 | 2026-07-16 |
| **P2: AI Post Gen** | 🔴 Not started | — | — |
| **P3: Publish + Links** | 🔴 Not started | — | — |
| **P4: Dashboard** | 🔴 Not started | — | — |
| **P5: Reel Generation** | 🔴 Not started | — | — |
| **P6: Billing & Polish** | 🔴 Not started | — | — |

---

## 🧠 Copywriting System

Ported from Whiskey's proven Vietnamese copywriting AI agent:
- **10 Hook Types**: Sự thật thú vị, Câu chuyện hấp dẫn, Câu hỏi kích thích tư duy, Hot trend, Số liệu cụ thể, Thông tin thiếu, Bí mật/Bí quyết, Tuyên bố gây sốc, Nếu... thì..., Hậu trường
- **4 Formulas**: AIDA, PAS, FAB, ABC Checklist
- **5 Tones**: Friendly, Professional, Humorous, Curious, Formal
- **3 Variants** per generation
- **Anti-AI-detection**: No clichés, natural voice, no engagement bait
- **Reel mode**: Ultra-short captions (<80 chars)
