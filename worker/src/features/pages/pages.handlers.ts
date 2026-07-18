import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { getUserIdFromRequest } from '../../core/auth.ts';
import { exchangeCodeForToken, getLongLivedToken, getUserPages, subscribePageToApp } from '../../core/facebook.ts';
import { analyzePageContent } from '../../core/ai.ts';
import { PageRepository } from '../../db/PageRepository.ts';
import { PostRepository } from '../../db/PostRepository.ts';
import { connectPagesSchema } from './pages.schemas.ts';

export const pagesRouter = new Hono<{ Bindings: Env }>();

// POST /api/pages/oauth — Exchange OAuth code for page access tokens
pagesRouter.post('/pages/oauth', zValidator('json', connectPagesSchema), async (c) => {
  const userId = await getUserIdFromRequest(c.req.raw, c.env);
  if (!userId) return c.json({ error: 'Unauthorized' }, 401);

  const body = c.req.valid('json');

  try {
    // Exchange code for short-lived token → long-lived token
    const tokenRes = await exchangeCodeForToken(
      body.code, c.env.FACEBOOK_APP_ID, c.env.FACEBOOK_APP_SECRET, body.redirectUri,
    );
    const longLived = await getLongLivedToken(tokenRes.access_token, c.env.FACEBOOK_APP_ID, c.env.FACEBOOK_APP_SECRET);

    // Get pages the user manages
    const fbPages = await getUserPages(longLived.access_token);

    // Save/Update pages in D1
    const saved = await PageRepository.saveOAuthPages(c.env.DB, userId, fbPages);

    // Subscribe Facebook App to webhooks for connected pages
    for (const page of fbPages) {
      try {
        await subscribePageToApp(page.access_token, page.id);
      } catch (err) {
        console.error(`Failed to subscribe Page ${page.id} on OAuth connection:`, err);
      }
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

  try {
    const pages = await PageRepository.getPagesByUser(c.env.DB, userId);
    return c.json(pages);
  } catch (err) {
    return c.json({ error: 'Failed to fetch pages' }, 500);
  }
});

// DELETE /api/pages/:id — Disconnect a page
pagesRouter.delete('/pages/:id', async (c) => {
  const userId = await getUserIdFromRequest(c.req.raw, c.env);
  if (!userId) return c.json({ error: 'Unauthorized' }, 401);

  const pageId = c.req.param('id');
  try {
    const existing = await PageRepository.findPageByIdAndUser(c.env.DB, pageId, userId);
    if (!existing) return c.json({ error: 'Page not found' }, 404);

    await PageRepository.deletePage(c.env.DB, pageId, userId);
    return c.json({ success: true });
  } catch (err) {
    return c.json({ error: 'Failed to disconnect page' }, 500);
  }
});

// POST /api/pages/:id/select — Set active page
pagesRouter.post('/pages/:id/select', async (c) => {
  const userId = await getUserIdFromRequest(c.req.raw, c.env);
  if (!userId) return c.json({ error: 'Unauthorized' }, 401);

  const pageId = c.req.param('id');
  try {
    const page = await PageRepository.findPageByIdAndUser(c.env.DB, pageId, userId);
    if (!page) return c.json({ error: 'Page not found' }, 404);

    // Subscribe page to Webhooks (self-healing hook registration)
    try {
      await subscribePageToApp(page.access_token, page.facebook_page_id);
    } catch (err) {
      console.error('Failed to subscribe Page webhooks:', err);
    }

    await PageRepository.setActivePage(c.env.DB, userId, pageId);
    return c.json({ success: true });
  } catch (err) {
    return c.json({ error: 'Failed to activate page' }, 500);
  }
});

// GET /api/pages/:id/analysis — Fetch latest page analysis
pagesRouter.get('/pages/:id/analysis', async (c) => {
  const userId = await getUserIdFromRequest(c.req.raw, c.env);
  if (!userId) return c.json({ error: 'Unauthorized' }, 401);

  const pageId = c.req.param('id');
  try {
    const analysis = await PageRepository.getLatestAnalysis(c.env.DB, pageId, userId);
    if (!analysis) return c.json(null);

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
    const page = await PageRepository.findPageByIdAndUser(c.env.DB, pageId, userId);
    if (!page) return c.json({ error: 'Page not found' }, 404);

    // Retrieve published posts with engagement metrics for this page
    const posts = await PostRepository.listPosts(c.env.DB, userId, {
      pageId,
      status: 'Published',
      limit: 50
    });

    const analysisResult = await analyzePageContent(posts, c.env.DEEPSEEK_API_KEY);

    const id = crypto.randomUUID();
    await PageRepository.insertAnalysis(c.env.DB, {
      id,
      page_id: pageId,
      user_id: userId,
      summary: analysisResult.summary,
      writing_style: analysisResult.writingStyleInstructions,
      suggestions: JSON.stringify(analysisResult.suggestions),
      charts_data: JSON.stringify(analysisResult.chartsData),
      metrics_summary: JSON.stringify(analysisResult.metricsSummary)
    });

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
