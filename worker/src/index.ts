import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { isAdminRequest, getUserIdFromRequest } from './core/auth.ts';
import { pagesRouter } from './features/pages/pages.handlers.ts';
import { postsRouter } from './features/posts/posts.handlers.ts';
import { mediaRouter } from './features/media/media.handlers.ts';
import { billingRouter } from './features/billing/billing.handlers.ts';
import { syncRouter } from './features/sync/sync.handlers.ts';
import { campaignsRouter } from './features/campaigns/campaigns.handlers.ts';

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
    R2_ACCESS_KEY_ID: string;
    R2_SECRET_ACCESS_KEY: string;
    R2_ACCOUNT_ID: string;
    BANK_BIN?: string;
    BANK_ACCOUNT?: string;
    BANK_ACCOUNT_NAME?: string;
    CLIPY_API_KEY?: string;
    CLIPY_API_URL?: string;
    FACEBOOK_WEBHOOK_VERIFY_TOKEN?: string;
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
      .prepare('SELECT role FROM user_profiles WHERE user_id = ?')
      .bind(userId)
      .first<{ role: string }>();

    if (!existing) {
      await c.env.DB
        .prepare('INSERT INTO user_profiles (user_id, tier, subscription_status, role) VALUES (?, ?, ?, ?)')
        .bind(userId, 'free', 'active', 'user')
        .run();
      return c.json({ success: true, role: 'user' });
    }
    return c.json({ success: true, role: existing.role });
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});

// ─── Admin Authorization Middleware ──────────────────────────────────────────
app.use('/api/*', async (c, next) => {
  if (c.req.method === 'OPTIONS') return next();
  if (c.req.path === '/api/webhooks/facebook') return next();
  const isAdmin = await isAdminRequest(c.req.raw, c.env);
  if (!isAdmin) {
    return c.json({ error: 'Forbidden: Admin access required' }, 403);
  }
  await next();
});

// ─── Health Check ────────────────────────────────────────────────────────────
app.get('/health', (c) => c.json({ status: 'ok', service: 'postie-worker' }));
app.get('/', (c) => c.json({ status: 'ok', service: 'postie-worker' }));



// ─── Public Media Serving from R2 ────────────────────────────────────────────
app.get('/media/file/:userId/*', async (c) => {
  const userId = c.req.param('userId');
  const filepath = c.req.param('*');
  if (!filepath) return c.json({ error: 'File not found' }, 404);
  const key = `${userId}/${filepath}`;

  try {
    const object = await c.env.IMAGES.get(key);
    if (!object) return c.json({ error: 'File not found' }, 404);

    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set('Access-Control-Allow-Origin', '*');
    headers.set('Cache-Control', 'public, max-age=31536000');
    headers.set('Content-Length', String(object.size));
    headers.set('Accept-Ranges', 'bytes');

    const rangeHeader = c.req.header('range');
    if (rangeHeader) {
      const rangeMatch = rangeHeader.match(/bytes=(\d+)-(\d*)/);
      if (rangeMatch) {
        const start = parseInt(rangeMatch[1]!, 10);
        const end = rangeMatch[2] ? parseInt(rangeMatch[2], 10) : object.size - 1;
        const rangeObj = await c.env.IMAGES.get(key, {
          range: { offset: start, length: end - start + 1 },
        });
        if (rangeObj) {
          headers.set('Content-Range', `bytes ${start}-${end}/${object.size}`);
          headers.set('Content-Length', String(end - start + 1));
          return new Response(rangeObj.body, { status: 206, headers });
        }
      }
    }

    return new Response(object.body, { status: 200, headers });
  } catch (err) {
    return c.json({ error: 'Failed to retrieve media file' }, 500);
  }
});

app.on('HEAD', '/media/file/:userId/*', async (c) => {
  const userId = c.req.param('userId');
  const filepath = c.req.param('*');
  if (!filepath) return c.json({ error: 'File not found' }, 404);
  const key = `${userId}/${filepath}`;

  try {
    const object = await c.env.IMAGES.head(key);
    if (!object) return c.json({ error: 'File not found' }, 404);

    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set('Access-Control-Allow-Origin', '*');
    headers.set('Cache-Control', 'public, max-age=31536000');
    headers.set('Content-Length', String(object.size));
    headers.set('Accept-Ranges', 'bytes');
    return new Response(null, { status: 200, headers });
  } catch (err) {
    return c.json({ error: 'Failed to retrieve media file' }, 500);
  }
});

// ─── Mount Feature Slice Routes ───────────────────────────────────────────────
app.route('/api', pagesRouter);
app.route('/api', postsRouter);
app.route('/api', mediaRouter);
app.route('/api', billingRouter);
app.route('/api', syncRouter);
app.route('/api', campaignsRouter);

export default app;
