import { Hono } from 'hono';
import { getUserIdFromRequest } from '../../core/auth.ts';
import { PageRepository } from '../../db/PageRepository.ts';
import { PostRepository } from '../../db/PostRepository.ts';
import { SyncService } from '../../services/SyncService.ts';
import { computeEngagementStats, formatSyncDuration, type SyncResult } from './sync.utils.ts';

export const syncRouter = new Hono<{ Bindings: Env }>();
const MAX_POSTS = 50;
const SUBREQ_LIMIT = 40;

// GET /api/sync/status
syncRouter.get('/sync/status', async (c) => {
  const uid = await getUserIdFromRequest(c.req.raw, c.env);
  if (!uid) return c.json({ error: 'Unauthorized' }, 401);

  try {
    const stats = await PostRepository.getSyncDashboardStats(c.env.DB, uid);
    const pages = await PageRepository.getPagesByUser(c.env.DB, uid);

    return c.json({
      totalPosts: stats.totalPosts,
      pages: pages.map(p => ({ id: p.id, name: p.name, username: p.username })),
      pageCount: pages.length,
      engagement: {
        totalLikes: stats.engagement.tl,
        totalComments: stats.engagement.tc,
        totalShares: stats.engagement.ts,
        totalViews: stats.engagement.tv,
      },
      lastSyncAt: stats.lastSyncAt
    });
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : 'Failed' }, 500);
  }
});

// GET /api/posts/:id/engagement
syncRouter.get('/posts/:id/engagement', async (c) => {
  const uid = await getUserIdFromRequest(c.req.raw, c.env);
  if (!uid) return c.json({ error: 'Unauthorized' }, 401);

  const pid = c.req.param('id');
  try {
    const post = await PostRepository.findByIdAndUser(c.env.DB, pid, uid);
    if (!post) return c.json({ error: 'Not found' }, 404);

    const engagement = post.engagement_fetched_at ? {
      likes: post.likes || 0,
      comments_count: post.comments_count || 0,
      shares: post.shares || 0,
      views: post.views || 0,
      fetched_at: post.engagement_fetched_at
    } : null;

    return c.json({ ...post, engagement });
  } catch (err) {
    return c.json({ error: 'Failed to fetch engagement' }, 500);
  }
});

// GET /api/posts/:id/comments
syncRouter.get('/posts/:id/comments', async (c) => {
  const uid = await getUserIdFromRequest(c.req.raw, c.env);
  if (!uid) return c.json({ error: 'Unauthorized' }, 401);

  const pid = c.req.param('id');
  try {
    const post = await PostRepository.findByIdAndUser(c.env.DB, pid, uid);
    if (!post) return c.json({ error: 'Not found' }, 404);

    if (post.facebook_post_id) {
      const page = await PageRepository.findPageByIdAndUser(c.env.DB, post.page_id, uid);
      if (page?.access_token) {
        await SyncService.syncComments(c.env.DB, page.access_token, pid, post.facebook_post_id);
      }
    }

    const { comments, replies } = await PostRepository.getComments(c.env.DB, pid);
    return c.json({
      comments,
      replies,
      totalCount: comments.length + replies.length
    });
  } catch (err) {
    return c.json({ error: 'Failed to sync comments' }, 500);
  }
});

// POST /api/sync/posts — Sync posts via Facebook Batch API
syncRouter.post('/sync/posts', async (c) => {
  const uid = await getUserIdFromRequest(c.req.raw, c.env);
  if (!uid) return c.json({ error: 'Unauthorized' }, 401);

  let targetPageId: string | undefined;
  try {
    const body = await c.req.json();
    targetPageId = body?.pageId;
  } catch {
    // Body is empty or not JSON, ignore
  }

  const startTime = Date.now();
  let totalFetched = 0;
  let totalSynced = 0;
  let subreq = 0;
  
  const allResults: SyncResult[] = [];
  const statements: D1PreparedStatement[] = [];

  try {
    let pages = await PageRepository.getPagesByUser(c.env.DB, uid);
    if (!pages.length) return c.json({ error: 'No Facebook pages connected.' }, 400);

    if (targetPageId && targetPageId !== 'all') {
      pages = pages.filter(p => p.id === targetPageId);
      if (!pages.length) return c.json({ error: 'Selected page not found.' }, 404);
    }

    for (const page of pages) {
      if (totalFetched >= MAX_POSTS || subreq >= SUBREQ_LIMIT) break;

      subreq++; // For getPagePosts Graph API call
      const { results, statements: pageStatements } = await SyncService.syncPagePosts(
        c.env.DB,
        uid,
        page,
        MAX_POSTS - totalFetched
      );

      subreq++; // For batchGetPostEngagements call
      totalFetched += results.length;
      totalSynced += results.filter(r => r.engagement !== null).length;
      allResults.push(...results);
      statements.push(...pageStatements);
    }

    if (statements.length > 0) {
      await c.env.DB.batch(statements);
    }

    const stats = computeEngagementStats(allResults);
    return c.json({
      success: true,
      duration: formatSyncDuration(startTime),
      totalFetched,
      totalSynced,
      pages: pages.length,
      pageNames: pages.map(p => p.name),
      subrequestsUsed: subreq,
      hasMore: totalFetched >= MAX_POSTS,
      results: allResults.slice(0, 50),
      stats
    });
  } catch (err) {
    return c.json({
      error: err instanceof Error ? err.message : 'Sync failed',
      partialResults: allResults,
      totalSynced
    }, 500);
  }
});