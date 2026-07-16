import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { isAdminRequest, getUserIdFromRequest } from './core/auth.ts';
import { pagesRouter } from './features/pages/pages.handlers.ts';
import { postsRouter } from './features/posts/posts.handlers.ts';
import { linksRouter } from './features/links/links.handlers.ts';
import { mediaRouter } from './features/media/media.handlers.ts';
import { billingRouter } from './features/billing/billing.handlers.ts';

// ─── Global Env Type ──────────────────────────────────────────────────────────
declare global {
  interface Env {
    DB: D1Database;
    IMAGES: R2Bucket;
    ALLOWED_ORIGINS: string;
    CLERK_JWKS_URL: string;
    DEEPSEEK_API_KEY: string;
    FACEBOOK_APP_ID: string;
    FACEBOOK_APP_SECRET: string;
    R2_PUBLIC_URL: string;
    BANK_BIN?: string;
    BANK_ACCOUNT?: string;
    BANK_ACCOUNT_NAME?: string;
  }
}

const app = new Hono<{ Bindings: Env }>();

// ─── CORS Middleware ──────────────────────────────────────────────────────────
app.use('*', async (c, next) => {
  const allowedOrigins = (c.env.ALLOWED_ORIGINS ?? '').split(',').map((o) => o.trim());
  const origin = c.req.header('Origin') || '';
  const isAllowed = allowedOrigins.includes(origin) || allowedOrigins.includes('*');

  const corsMiddleware = cors({
    origin: isAllowed ? origin : (allowedOrigins[0] ?? '*'),
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
    maxAge: 86400,
    credentials: true,
  });
  return corsMiddleware(c, next);
});

// ─── Auth Sync Endpoint (Bypass Admin checking for initial signups) ──────────
app.post('/api/auth/sync', async (c) => {
  const userId = await getUserIdFromRequest(c.req.raw, c.env);
  if (!userId) return c.json({ error: 'Unauthorized' }, 401);

  try {
    const existing = await c.env.DB
      .prepare('SELECT user_id FROM user_profiles WHERE user_id = ?')
      .bind(userId)
      .first();

    if (!existing) {
      await c.env.DB
        .prepare('INSERT INTO user_profiles (user_id, tier, subscription_status) VALUES (?, ?, ?)')
        .bind(userId, 'free', 'active')
        .run();
    }
    return c.json({ success: true });
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});

// ─── Admin Authorization Middleware ──────────────────────────────────────────
app.use('/api/*', async (c, next) => {
  if (c.req.method === 'OPTIONS') return next();
  const isAdmin = await isAdminRequest(c.req.raw, c.env);
  if (!isAdmin) {
    return c.json({ error: 'Forbidden: Admin access required' }, 403);
  }
  await next();
});

// ─── Health Check ────────────────────────────────────────────────────────────
app.get('/health', (c) => c.json({ status: 'ok', service: 'postie-worker' }));
app.get('/', (c) => c.json({ status: 'ok', service: 'postie-worker' }));

// ─── Mount Feature Slice Routes ───────────────────────────────────────────────
app.route('/api', pagesRouter);
app.route('/api', postsRouter);
app.route('/api', linksRouter);
app.route('/api', mediaRouter);
app.route('/api', billingRouter);

export default app;
