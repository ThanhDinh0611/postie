import { Hono } from 'hono';
import { getUserIdFromRequest } from '../../core/auth.ts';

export const linksRouter = new Hono<{ Bindings: Env }>();

// GET /api/links — List all generated links for the user
linksRouter.get('/links', async (c) => {
  const userId = await getUserIdFromRequest(c.req.raw, c.env);
  if (!userId) return c.json({ error: 'Unauthorized' }, 401);

  const rows = await c.env.DB
    .prepare(
      `SELECT p.id, p.permalink, p.facebook_post_id, p.message, p.status, p.published_at, p.created_at,
              pg.name as page_name, pg.username as page_username
       FROM posts p
       JOIN pages pg ON p.page_id = pg.id
       WHERE p.user_id = ? AND p.permalink IS NOT NULL
       ORDER BY p.created_at DESC`,
    )
    .bind(userId)
    .all();

  return c.json(rows.results ?? []);
});

// GET /api/links/:postId — Get a single post's link details
linksRouter.get('/links/:postId', async (c) => {
  const userId = await getUserIdFromRequest(c.req.raw, c.env);
  if (!userId) return c.json({ error: 'Unauthorized' }, 401);

  const postId = c.req.param('postId');
  const row = await c.env.DB
    .prepare(
      `SELECT p.id, p.permalink, p.facebook_post_id, p.message, p.status, p.published_at, p.created_at,
              pg.name as page_name, pg.username as page_username
       FROM posts p
       JOIN pages pg ON p.page_id = pg.id
       WHERE p.id = ? AND p.user_id = ?`,
    )
    .bind(postId, userId)
    .first();

  if (!row) return c.json({ error: 'Link not found' }, 404);
  return c.json(row);
});
