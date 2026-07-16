import { Hono } from 'hono';
import { getUserIdFromRequest } from '../../core/auth.ts';
import { exchangeCodeForToken, getLongLivedToken, getUserPages } from '../../core/facebook.ts';

export const pagesRouter = new Hono<{ Bindings: Env }>();

// POST /api/pages/oauth — Exchange OAuth code for page access tokens
pagesRouter.post('/pages/oauth', async (c) => {
  const userId = await getUserIdFromRequest(c.req.raw, c.env);
  if (!userId) return c.json({ error: 'Unauthorized' }, 401);

  let body: { code?: string; redirectUri?: string };
  try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON' }, 400); }

  if (!body.code || !body.redirectUri) {
    return c.json({ error: 'code and redirectUri are required' }, 400);
  }

  try {
    // Exchange code for short-lived token → long-lived token
    const tokenRes = await exchangeCodeForToken(
      body.code, c.env.FACEBOOK_APP_ID, c.env.FACEBOOK_APP_SECRET, body.redirectUri,
    );
    const longLived = await getLongLivedToken(tokenRes.access_token, c.env.FACEBOOK_APP_ID, c.env.FACEBOOK_APP_SECRET);

    // Get pages the user manages
    const pages = await getUserPages(longLived.access_token);

    // Store pages in D1
    const saved: Array<{ id: string; name: string; username?: string; avatarUrl?: string }> = [];
    for (const page of pages) {
      const id = crypto.randomUUID();
      await c.env.DB
        .prepare(
          `INSERT OR REPLACE INTO pages (id, facebook_page_id, name, username, access_token, avatar_url, user_id)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(id, page.id, page.name, page.username ?? null, page.access_token, page.picture?.data?.url ?? null, userId)
        .run();
      saved.push({ id, name: page.name, username: page.username, avatarUrl: page.picture?.data?.url });
    }

    return c.json({ pages: saved });
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : 'OAuth failed' }, 400);
  }
});

// GET /api/pages — List connected pages
pagesRouter.get('/pages', async (c) => {
  const userId = await getUserIdFromRequest(c.req.raw, c.env);
  if (!userId) return c.json({ error: 'Unauthorized' }, 401);

  const rows = await c.env.DB
    .prepare('SELECT id, facebook_page_id, name, username, avatar_url, is_active FROM pages WHERE user_id = ? ORDER BY created_at DESC')
    .bind(userId)
    .all<{ id: string; facebook_page_id: string; name: string; username: string | null; avatar_url: string | null; is_active: number }>();

  return c.json(rows.results ?? []);
});

// DELETE /api/pages/:id — Disconnect a page
pagesRouter.delete('/pages/:id', async (c) => {
  const userId = await getUserIdFromRequest(c.req.raw, c.env);
  if (!userId) return c.json({ error: 'Unauthorized' }, 401);

  const pageId = c.req.param('id');
  const existing = await c.env.DB
    .prepare('SELECT id FROM pages WHERE id = ? AND user_id = ?')
    .bind(pageId, userId)
    .first();

  if (!existing) return c.json({ error: 'Page not found' }, 404);

  await c.env.DB.prepare('DELETE FROM pages WHERE id = ? AND user_id = ?').bind(pageId, userId).run();
  return c.json({ success: true });
});

// POST /api/pages/:id/select — Set active page
pagesRouter.post('/pages/:id/select', async (c) => {
  const userId = await getUserIdFromRequest(c.req.raw, c.env);
  if (!userId) return c.json({ error: 'Unauthorized' }, 401);

  const pageId = c.req.param('id');
  const existing = await c.env.DB
    .prepare('SELECT id FROM pages WHERE id = ? AND user_id = ?')
    .bind(pageId, userId)
    .first();

  if (!existing) return c.json({ error: 'Page not found' }, 404);

  // Deactivate all, then activate selected
  await c.env.DB.prepare('UPDATE pages SET is_active = 0 WHERE user_id = ?').bind(userId).run();
  await c.env.DB.prepare('UPDATE pages SET is_active = 1 WHERE id = ?').bind(pageId).run();

  return c.json({ success: true });
});
