import { Hono } from 'hono';
import { getUserIdFromRequest } from '../../core/auth.ts';
import { exchangeCodeForToken, getLongLivedToken, getUserPages, subscribePageToApp } from '../../core/facebook.ts';
import { analyzePageContent } from '../../core/ai.ts';

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

    // Optimize: Batch insert/replace pages in D1
    const saved: Array<{ id: string; name: string; username?: string; avatarUrl?: string }> = [];
    const statements: D1PreparedStatement[] = [];
    
    for (const page of pages) {
      const id = crypto.randomUUID();
      statements.push(c.env.DB
        .prepare(
          `INSERT OR REPLACE INTO pages (id, facebook_page_id, name, username, access_token, avatar_url, user_id)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(id, page.id, page.name, page.username ?? null, page.access_token, page.picture?.data?.url ?? null, userId)
      );
      
      // Subscribe the Facebook App to this page's webhooks
      try {
        await subscribePageToApp(page.access_token, page.id);
      } catch (err) {
        console.error(`Failed to subscribe Page ${page.id} on OAuth connection:`, err);
      }

      saved.push({ id, name: page.name, username: page.username, avatarUrl: page.picture?.data?.url });
    }

    if (statements.length > 0) {
      await c.env.DB.batch(statements);
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
  const page = await c.env.DB
    .prepare('SELECT facebook_page_id, access_token FROM pages WHERE id = ? AND user_id = ?')
    .bind(pageId, userId)
    .first<{ facebook_page_id: string; access_token: string }>();

  if (!page) return c.json({ error: 'Page not found' }, 404);

  // Subscribe page to Webhooks (self-healing hook registration)
  try {
    await subscribePageToApp(page.access_token, page.facebook_page_id);
  } catch (err) {
    console.error('Failed to subscribe Page webhooks:', err);
  }

  // Optimize: Batch deactivation and activation writes in a single D1 roundtrip
  await c.env.DB.batch([
    c.env.DB.prepare('UPDATE pages SET is_active = 0 WHERE user_id = ?').bind(userId),
    c.env.DB.prepare('UPDATE pages SET is_active = 1 WHERE id = ?').bind(pageId)
  ]);

  return c.json({ success: true });
});

// GET /api/pages/:id/analysis — Fetch latest page analysis
pagesRouter.get('/pages/:id/analysis', async (c) => {
  const userId = await getUserIdFromRequest(c.req.raw, c.env);
  if (!userId) return c.json({ error: 'Unauthorized' }, 401);

  const pageId = c.req.param('id');
  try {
    const analysis = await c.env.DB
      .prepare('SELECT * FROM page_analyses WHERE page_id = ? AND user_id = ? ORDER BY analyzed_at DESC LIMIT 1')
      .bind(pageId, userId)
      .first<{
        id: string; page_id: string; user_id: string; analyzed_at: number;
        summary: string; writing_style: string; suggestions: string;
        charts_data: string; metrics_summary: string;
      }>();

    if (!analysis) {
      return c.json(null);
    }

    return c.json({
      id: analysis.id,
      pageId: analysis.page_id,
      userId: analysis.user_id,
      analyzedAt: analysis.analyzed_at,
      summary: analysis.summary,
      writingStyleInstructions: analysis.writing_style,
      suggestions: JSON.parse(analysis.suggestions),
      chartsData: JSON.parse(analysis.charts_data),
      metricsSummary: JSON.parse(analysis.metrics_summary)
    });
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : 'Failed to fetch analysis' }, 500);
  }
});

// POST /api/pages/:id/analyze — Run AI strategic analysis on the page's posts
pagesRouter.post('/pages/:id/analyze', async (c) => {
  const userId = await getUserIdFromRequest(c.req.raw, c.env);
  if (!userId) return c.json({ error: 'Unauthorized' }, 401);

  const pageId = c.req.param('id');
  
  try {
    const page = await c.env.DB
      .prepare('SELECT id FROM pages WHERE id = ? AND user_id = ?')
      .bind(pageId, userId)
      .first();

    if (!page) {
      return c.json({ error: 'Page not found' }, 404);
    }

    // Retrieve published posts with engagement metrics for this page
    const posts = await c.env.DB
      .prepare(`
        SELECT message, post_format, hook_type, copywriting_formula, tone, likes, comments_count, shares, views, created_at 
        FROM posts 
        WHERE page_id = ? AND user_id = ? AND status = 'Published'
        ORDER BY created_at DESC 
        LIMIT 50
      `)
      .bind(pageId, userId)
      .all<{
        message: string; post_format: string; hook_type: string | null;
        copywriting_formula: string | null; tone: string | null;
        likes: number; comments_count: number; shares: number; views: number; created_at: number;
      }>();

    const analysisResult = await analyzePageContent(posts.results ?? [], c.env.DEEPSEEK_API_KEY);

    const id = crypto.randomUUID();
    await c.env.DB
      .prepare(`
        INSERT INTO page_analyses (id, page_id, user_id, summary, writing_style, suggestions, charts_data, metrics_summary) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .bind(
        id, pageId, userId, 
        analysisResult.summary, 
        analysisResult.writingStyleInstructions, 
        JSON.stringify(analysisResult.suggestions), 
        JSON.stringify(analysisResult.chartsData), 
        JSON.stringify(analysisResult.metricsSummary)
      )
      .run();

    return c.json({
      id,
      pageId,
      analyzedAt: Math.floor(Date.now() / 1000),
      ...analysisResult
    });
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : 'Analysis failed' }, 500);
  }
});
