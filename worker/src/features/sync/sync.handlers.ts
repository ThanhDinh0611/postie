import { Hono } from 'hono';
import { getUserIdFromRequest } from '../../core/auth.ts';
import { getPagePosts, batchGetPostEngagements, getPostComments } from '../../core/facebook.ts';
import { computeEngagementStats, formatSyncDuration, type SyncResult } from './sync.utils.ts';

export const syncRouter = new Hono<{ Bindings: Env }>();
const MAX_POSTS = 50;
const SUBREQ_LIMIT = 40;

// GET /api/sync/status
syncRouter.get('/sync/status', async (c) => {
  const uid = await getUserIdFromRequest(c.req.raw, c.env);
  if (!uid) return c.json({ error: 'Unauthorized' }, 401);
  try {
    const [pc, es, ls, pi] = await Promise.all([
      c.env.DB.prepare('SELECT COUNT(*) as c FROM posts WHERE user_id=? AND status=?').bind(uid, 'Published').first<{ c: number }>(),
      c.env.DB.prepare('SELECT COALESCE(SUM(likes),0) tl, COALESCE(SUM(comments_count),0) tc, COALESCE(SUM(shares),0) ts, COALESCE(SUM(views),0) tv FROM posts WHERE user_id=?').bind(uid).first<{ tl: number; tc: number; ts: number; tv: number }>(),
      c.env.DB.prepare('SELECT MAX(last_synced_at) ls FROM posts WHERE user_id=?').bind(uid).first<{ ls: number | null }>(),
      c.env.DB.prepare('SELECT id,name,username FROM pages WHERE user_id=? ORDER BY name').bind(uid).all<{ id: string; name: string; username: string | null }>(),
    ]);
    return c.json({ totalPosts: pc?.c ?? 0, pages: pi.results ?? [], pageCount: pi.results?.length ?? 0, engagement: es ?? { tl: 0, tc: 0, ts: 0, tv: 0 }, lastSyncAt: ls?.ls ?? null });
  } catch (err) { return c.json({ error: err instanceof Error ? err.message : 'Failed' }, 500); }
});

// GET /api/posts/:id/engagement
syncRouter.get('/posts/:id/engagement', async (c) => {
  const uid = await getUserIdFromRequest(c.req.raw, c.env);
  if (!uid) return c.json({ error: 'Unauthorized' }, 401);
  const pid = c.req.param('id');
  const post = await c.env.DB.prepare('SELECT p.*, pg.name page_name FROM posts p JOIN pages pg ON p.page_id=pg.id WHERE p.id=? AND p.user_id=?').bind(pid, uid).first<any>();
  if (!post) return c.json({ error: 'Not found' }, 404);
  
  const engagement = post.engagement_fetched_at ? {
    likes: post.likes || 0,
    comments_count: post.comments_count || 0,
    shares: post.shares || 0,
    views: post.views || 0,
    fetched_at: post.engagement_fetched_at
  } : null;
  
  return c.json({ ...post, engagement });
});

// GET /api/posts/:id/comments
syncRouter.get('/posts/:id/comments', async (c) => {
  const uid = await getUserIdFromRequest(c.req.raw, c.env);
  if (!uid) return c.json({ error: 'Unauthorized' }, 401);
  const pid = c.req.param('id');
  const post = await c.env.DB.prepare('SELECT id,facebook_post_id FROM posts WHERE id=? AND user_id=?').bind(pid, uid).first<{ id: string; facebook_post_id: string | null }>();
  if (!post) return c.json({ error: 'Not found' }, 404);

  if (post.facebook_post_id) {
    const page = await c.env.DB.prepare('SELECT access_token FROM pages p JOIN posts po ON p.id=po.page_id WHERE po.id=?').bind(pid).first<{ access_token: string }>();
    if (page?.access_token) {
      try {
        const fbC = await getPostComments(page.access_token, post.facebook_post_id);
        
        // Optimize: Batch check existing comment IDs
        const ids: string[] = [];
        for (const c2 of fbC) {
          ids.push(c2.id);
          if (c2.comments?.data) {
            for (const r of c2.comments.data) {
              ids.push(r.id);
            }
          }
        }

        const existingSet = new Set<string>();
        if (ids.length > 0) {
          const ph = ids.map(() => '?').join(',');
          const existingComments = await c.env.DB.prepare(`SELECT facebook_comment_id FROM post_comments WHERE facebook_comment_id IN (${ph})`).bind(...ids).all<{ facebook_comment_id: string }>();
          existingComments.results?.forEach(r => existingSet.add(r.facebook_comment_id));
        }

        // Optimize: Batch insert new comments
        const statements: D1PreparedStatement[] = [];
        for (const c2 of fbC) {
          if (!existingSet.has(c2.id)) {
            statements.push(c.env.DB.prepare(`
              INSERT INTO post_comments(id,facebook_comment_id,post_id,from_name,from_id,message,like_count,created_time,fetched_at) 
              VALUES(?,?,?,?,?,?,?,?,unixepoch())
            `).bind(
              crypto.randomUUID(),
              c2.id,
              pid,
              c2.from?.name ?? null,
              c2.from?.id ?? null,
              c2.message ?? '',
              c2.like_count ?? 0,
              c2.created_time ? Math.floor(new Date(c2.created_time).getTime() / 1000) : null
            ));
          }
          if (c2.comments?.data) {
            for (const r of c2.comments.data) {
              if (!existingSet.has(r.id)) {
                statements.push(c.env.DB.prepare(`
                  INSERT INTO post_comments(id,facebook_comment_id,post_id,from_name,from_id,message,like_count,created_time,parent_id,fetched_at) 
                  VALUES(?,?,?,?,?,?,?,?,?,unixepoch())
                `).bind(
                  crypto.randomUUID(),
                  r.id,
                  pid,
                  r.from?.name ?? null,
                  r.from?.id ?? null,
                  r.message ?? '',
                  r.like_count ?? 0,
                  r.created_time ? Math.floor(new Date(r.created_time).getTime() / 1000) : null,
                  c2.id
                ));
              }
            }
          }
        }

        if (statements.length > 0) {
          await c.env.DB.batch(statements);
        }
      } catch (err) {
        console.error('Failed to sync comments:', err);
      }
    }
  }

  const comments = await c.env.DB.prepare('SELECT * FROM post_comments WHERE post_id=? AND parent_id IS NULL ORDER BY created_time DESC LIMIT 100').bind(pid).all();
  const replies = await c.env.DB.prepare('SELECT * FROM post_comments WHERE post_id=? AND parent_id IS NOT NULL ORDER BY created_time ASC').bind(pid).all();
  return c.json({ comments: comments.results ?? [], replies: replies.results ?? [], totalCount: (comments.results?.length ?? 0) + (replies.results?.length ?? 0) });
});

// POST /api/sync/posts — Sync posts via Facebook Batch API
syncRouter.post('/sync/posts', async (c) => {
  const uid = await getUserIdFromRequest(c.req.raw, c.env);
  if (!uid) return c.json({ error: 'Unauthorized' }, 401);

  const startTime = Date.now();
  let totalFetched = 0, totalSynced = 0, subreq = 0;
  const allResults: SyncResult[] = [];
  const statements: D1PreparedStatement[] = [];

  try {
    const pages = await c.env.DB.prepare('SELECT id,facebook_page_id,name,access_token FROM pages WHERE user_id=?').bind(uid).all<{ id: string; facebook_page_id: string; name: string; access_token: string }>();
    if (!pages.results?.length) return c.json({ error: 'No Facebook pages connected.' }, 400);

    for (const page of pages.results) {
      if (totalFetched >= MAX_POSTS || subreq >= SUBREQ_LIMIT) break;

      const fbPosts = await getPagePosts(page.access_token, page.facebook_page_id, MAX_POSTS);
      subreq++;
      if (!fbPosts.length) continue;

      const ids = fbPosts.map((p) => p.id);
      const ph = ids.map(() => '?').join(',');
      
      // Optimize: Fetch both ID and facebook_post_id in a single query
      const existingRows = await c.env.DB.prepare(`SELECT id, facebook_post_id FROM posts WHERE facebook_post_id IN (${ph}) AND page_id=?`).bind(...ids, page.id).all<{ id: string; facebook_post_id: string }>();
      const existingMap = new Map(existingRows.results?.map((r) => [r.facebook_post_id, r.id]) ?? []);

      const toProcess = fbPosts.filter(() => totalFetched < MAX_POSTS).map((p) => { totalFetched++; return { ...p, isNew: !existingMap.has(p.id) }; });
      if (!toProcess.length) continue;

      const engagementMap = await batchGetPostEngagements(page.access_token, toProcess.map((p) => p.id));
      subreq++;

      for (const p of toProcess) {
        const engagement = engagementMap.get(p.id) ?? null;
        let postId: string;

        if (!p.isNew) {
          const existingId = existingMap.get(p.id);
          if (!existingId) continue;
          postId = existingId;
          
          if (engagement) {
            statements.push(c.env.DB.prepare(`
              UPDATE posts 
              SET last_synced_at=unixepoch(),
                  likes=?, comments_count=?, shares=?, views=?, engagement_fetched_at=unixepoch() 
              WHERE id=?
            `).bind(engagement.likes, engagement.comments, engagement.shares, engagement.views, postId));
            totalSynced++;
          } else {
            statements.push(c.env.DB.prepare('UPDATE posts SET last_synced_at=unixepoch() WHERE id=?').bind(postId));
          }
        } else {
          postId = crypto.randomUUID();
          const pubAt = p.created_time ? Math.floor(new Date(p.created_time).getTime() / 1000) : null;
          
          if (engagement) {
            statements.push(c.env.DB.prepare(`
              INSERT INTO posts(id,page_id,facebook_post_id,permalink,message,post_format,status,created_at,published_at,user_id,last_synced_at,likes,comments_count,shares,views,engagement_fetched_at) 
              VALUES(?,?,?,?,?,?,'Published',?,?,?,unixepoch(),?,?,?,?,unixepoch())
            `).bind(postId, page.id, p.id, p.permalink_url ?? null, p.message ?? '', 'Post', pubAt ?? Math.floor(Date.now() / 1000), pubAt, uid, engagement.likes, engagement.comments, engagement.shares, engagement.views));
            totalSynced++;
          } else {
            statements.push(c.env.DB.prepare(`
              INSERT INTO posts(id,page_id,facebook_post_id,permalink,message,post_format,status,created_at,published_at,user_id,last_synced_at) 
              VALUES(?,?,?,?,?,?,'Published',?,?,?,unixepoch())
            `).bind(postId, page.id, p.id, p.permalink_url ?? null, p.message ?? '', 'Post', pubAt ?? Math.floor(Date.now() / 1000), pubAt, uid));
          }
        }

        allResults.push({ postId, facebookPostId: p.id, message: (p.message ?? '').slice(0, 100), pageName: page.name, status: 'Published', engagement, syncedAt: Math.floor(Date.now() / 1000) });
      }
    }

    // Optimize: Batch execute all database inserts and updates in a single network call
    if (statements.length > 0) {
      await c.env.DB.batch(statements);
    }

    return c.json({ success: true, duration: formatSyncDuration(startTime), totalFetched, totalSynced, pages: pages.results.length, pageNames: pages.results.map((p) => p.name), subrequestsUsed: subreq, hasMore: totalFetched >= MAX_POSTS, results: allResults.slice(0, 50), stats: computeEngagementStats(allResults) });
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : 'Sync failed', partialResults: allResults, totalSynced }, 500);
  }
});