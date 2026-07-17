import { Hono } from 'hono';
import { getUserIdFromRequest } from '../../core/auth.ts';

export const campaignsRouter = new Hono<{ Bindings: Env }>();

// GET /api/campaigns — List campaigns
campaignsRouter.get('/campaigns', async (c) => {
  const userId = await getUserIdFromRequest(c.req.raw, c.env);
  if (!userId) return c.json({ error: 'Unauthorized' }, 401);

  try {
    const { results } = await c.env.DB
      .prepare('SELECT * FROM campaigns WHERE user_id = ? ORDER BY created_at DESC')
      .bind(userId)
      .all<{ id: string; user_id: string; title: string; description: string | null; color: string; created_at: number }>();
    
    return c.json(results ?? []);
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : 'Failed to fetch campaigns' }, 500);
  }
});

// POST /api/campaigns — Create a campaign
campaignsRouter.post('/campaigns', async (c) => {
  const userId = await getUserIdFromRequest(c.req.raw, c.env);
  if (!userId) return c.json({ error: 'Unauthorized' }, 401);

  let body: { title: string; description?: string; color?: string };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON' }, 400);
  }

  if (!body.title) {
    return c.json({ error: 'title is required' }, 400);
  }

  const id = crypto.randomUUID();
  const color = body.color ?? '#3b82f6';
  const description = body.description ?? null;

  try {
    await c.env.DB
      .prepare('INSERT INTO campaigns (id, user_id, title, description, color) VALUES (?, ?, ?, ?, ?)')
      .bind(id, userId, body.title, description, color)
      .run();

    return c.json({ id, title: body.title, description, color });
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : 'Failed to create campaign' }, 500);
  }
});

// PUT /api/campaigns/:id — Update a campaign
campaignsRouter.put('/campaigns/:id', async (c) => {
  const userId = await getUserIdFromRequest(c.req.raw, c.env);
  if (!userId) return c.json({ error: 'Unauthorized' }, 401);

  const id = c.req.param('id');
  let body: { title?: string; description?: string; color?: string };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON' }, 400);
  }

  try {
    const existing = await c.env.DB
      .prepare('SELECT id FROM campaigns WHERE id = ? AND user_id = ?')
      .bind(id, userId)
      .first();

    if (!existing) {
      return c.json({ error: 'Campaign not found' }, 404);
    }

    const updates: string[] = [];
    const binds: unknown[] = [];

    if (body.title !== undefined) {
      updates.push('title = ?');
      binds.push(body.title);
    }
    if (body.description !== undefined) {
      updates.push('description = ?');
      binds.push(body.description || null);
    }
    if (body.color !== undefined) {
      updates.push('color = ?');
      binds.push(body.color);
    }

    if (updates.length === 0) {
      return c.json({ message: 'No changes' });
    }

    binds.push(id, userId);
    await c.env.DB
      .prepare(`UPDATE campaigns SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`)
      .bind(...binds)
      .run();

    return c.json({ success: true, id });
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : 'Failed to update campaign' }, 500);
  }
});

// DELETE /api/campaigns/:id — Delete a campaign
campaignsRouter.delete('/campaigns/:id', async (c) => {
  const userId = await getUserIdFromRequest(c.req.raw, c.env);
  if (!userId) return c.json({ error: 'Unauthorized' }, 401);

  const id = c.req.param('id');

  try {
    const existing = await c.env.DB
      .prepare('SELECT id FROM campaigns WHERE id = ? AND user_id = ?')
      .bind(id, userId)
      .first();

    if (!existing) {
      return c.json({ error: 'Campaign not found' }, 404);
    }

    await c.env.DB
      .prepare('DELETE FROM campaigns WHERE id = ? AND user_id = ?')
      .bind(id, userId)
      .run();

    return c.json({ success: true });
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : 'Failed to delete campaign' }, 500);
  }
});
