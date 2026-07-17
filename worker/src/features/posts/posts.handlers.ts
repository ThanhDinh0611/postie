import { Hono } from 'hono';
import { getUserIdFromRequest, authorizeFeature } from '../../core/auth.ts';
import { generatePostContent } from '../../core/ai.ts';
import type { GenerateRequest } from '../../core/ai.ts';
import { publishPost, buildPermalink, clearFacebookCache } from '../../core/facebook.ts';

export const postsRouter = new Hono<{ Bindings: Env }>();

// ─── Publish endpoint ─────────────────────────────────────────────────────────

// POST /api/posts/publish — Publish a post to Facebook
postsRouter.post('/posts/publish', async (c) => {
  const userId = await getUserIdFromRequest(c.req.raw, c.env);
  if (!userId) return c.json({ error: 'Unauthorized' }, 401);

  const authResult = await authorizeFeature(userId, 'maxPostsPerMonth', c.env, c.req.raw);
  if (!authResult.authorized) return c.json({ error: authResult.reason }, 403);

  let body: {
    content: string;
    pageId?: string;
    mediaUrl?: string;
    scheduledAt?: number;
    hookType?: string;
    formula?: string;
    tone?: string;
    postFormat?: string;
    campaignId?: string;
    generationId?: string;
    publishType?: 'image' | 'link';
    targetUrl?: string;
    linkTitle?: string;
    linkDescription?: string;
  };
  try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON' }, 400); }
  if (!body.content) return c.json({ error: 'content is required' }, 400);

  // Get the active page or specified page
  let pageId = body.pageId;
  if (!pageId) {
    const activePage = await c.env.DB
      .prepare('SELECT id, facebook_page_id, name, username, access_token FROM pages WHERE user_id = ? AND is_active = 1')
      .bind(userId)
      .first<{ id: string; facebook_page_id: string; name: string; username: string | null; access_token: string }>();
    if (!activePage) return c.json({ error: 'No active Facebook page. Connect and select a page first.' }, 400);
    pageId = activePage.id;
  }

  const page = await c.env.DB
    .prepare('SELECT id, facebook_page_id, name, username, access_token FROM pages WHERE id = ? AND user_id = ?')
    .bind(pageId, userId)
    .first<{ id: string; facebook_page_id: string; name: string; username: string | null; access_token: string }>();
  if (!page) return c.json({ error: 'Page not found' }, 404);

  // Securely handle Clipy short-link generation on the backend
  let shortUrl = '';
  if (body.publishType === 'link') {
    if (!c.env.CLIPY_API_KEY) {
      throw new Error('Lỗi cấu hình hệ thống: CLIPY_API_KEY chưa được khai báo trên Worker.');
    }
    const clipyUrl = c.env.CLIPY_API_URL || 'https://clipy-worker.dct98.workers.dev/api';
    try {
      const linkRes = await fetch(`${clipyUrl}/links`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${c.env.CLIPY_API_KEY}`
        },
        body: JSON.stringify({
          target_url: body.targetUrl || 'https://google.com',
          title: body.linkTitle || body.content.slice(0, 60),
          description: body.linkDescription || 'Shared via Clipy',
          image_url: body.mediaUrl || ''
        })
      });
      if (linkRes.ok) {
        const linkData = await linkRes.json() as { short_code: string };
        const baseRedirectUrl = clipyUrl.replace(/\/api$/, '');
        shortUrl = `${baseRedirectUrl}/${linkData.short_code}`;
      } else {
        const errText = await linkRes.text();
        throw new Error(`Clipy API Error (${linkRes.status}): ${errText}`);
      }
    } catch (e) {
      throw new Error(`Lỗi kết nối Clipy API: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  const finalContent = shortUrl ? `${body.content}\n\n👉 Chi tiết xem tại: ${shortUrl}` : body.content;
  // If link post, Facebook parses target OG metadata; don't attach raw mediaUrl to make a standalone photo post
  const fbMediaUrl = body.publishType === 'image' ? body.mediaUrl : undefined;

  try {
    const fbResult = await publishPost(page.access_token, page.facebook_page_id, finalContent, fbMediaUrl, body.scheduledAt);
    const permalink = buildPermalink(page.username ?? page.facebook_page_id, fbResult.id);

    const postId = crypto.randomUUID();
    await c.env.DB
      .prepare(
         `INSERT INTO posts (id, page_id, facebook_post_id, permalink, message, media_url, hook_type, copywriting_formula, tone, post_format, status, scheduled_for, published_at, user_id, campaign_id, generation_id)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(postId, page.id, fbResult.id, permalink, finalContent,
        body.mediaUrl ?? null, body.hookType ?? null, body.formula ?? null,
        body.tone ?? 'Friendly', body.postFormat ?? 'Post',
        body.scheduledAt ? 'Scheduled' : 'Published',
        body.scheduledAt ?? null, body.scheduledAt ? null : Math.floor(Date.now() / 1000), userId,
        body.campaignId ?? null, body.generationId ?? null)
      .run();

    return c.json({ postId, facebookPostId: fbResult.id, permalink, status: body.scheduledAt ? 'Scheduled' : 'Published' });
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : 'Publishing failed' }, 500);
  }
});

// GET /api/posts — List user's posts
postsRouter.get('/posts', async (c) => {
  const userId = await getUserIdFromRequest(c.req.raw, c.env);
  if (!userId) return c.json({ error: 'Unauthorized' }, 401);

  const { status, pageId, campaignId, sortBy = 'latest', limit = '20', offset = '0' } = c.req.query();
  let query = `
    SELECT p.*, pg.name as page_name, cmp.title as campaign_title, cmp.color as campaign_color 
    FROM posts p 
    JOIN pages pg ON p.page_id = pg.id 
    LEFT JOIN campaigns cmp ON p.campaign_id = cmp.id
    WHERE p.user_id = ?
  `;
  const binds: unknown[] = [userId];

  if (status) { query += ' AND p.status = ?'; binds.push(status); }
  if (pageId) { query += ' AND p.page_id = ?'; binds.push(pageId); }
  if (campaignId) { query += ' AND p.campaign_id = ?'; binds.push(campaignId); }

  let orderBy = 'p.created_at DESC';
  if (sortBy === 'likes') orderBy = 'p.likes DESC';
  else if (sortBy === 'comments') orderBy = 'p.comments_count DESC';
  else if (sortBy === 'shares') orderBy = 'p.shares DESC';
  else if (sortBy === 'views') orderBy = 'p.views DESC';
  else if (sortBy === 'engagement') orderBy = '(p.likes + p.comments_count + p.shares) DESC';

  query += ` ORDER BY ${orderBy} LIMIT ? OFFSET ?`;
  binds.push(Number(limit), Number(offset));

  const rows = await c.env.DB.prepare(query).bind(...binds).all();
  return c.json(rows.results ?? []);
});

// POST /api/posts/:id/clear-cache — Clear Facebook/Zalo cache for a post link
postsRouter.post('/posts/:id/clear-cache', async (c) => {
  const userId = await getUserIdFromRequest(c.req.raw, c.env);
  if (!userId) return c.json({ error: 'Unauthorized' }, 401);

  const postId = c.req.param('id');
  const post = await c.env.DB
    .prepare('SELECT p.permalink, pg.access_token FROM posts p JOIN pages pg ON p.page_id = pg.id WHERE p.id = ? AND p.user_id = ?')
    .bind(postId, userId)
    .first<{ permalink: string; access_token: string }>();

  if (!post?.permalink) return c.json({ error: 'Post not found or not published' }, 404);

  const results: Record<string, string> = {};
  try { await clearFacebookCache(post.access_token, post.permalink); results.facebook = 'success'; }
  catch (e) { results.facebook = `failed: ${e instanceof Error ? e.message : String(e)}`; }

  return c.json({ success: true, url: post.permalink, results });
});
// POST /api/posts/generate — AI generate post content
postsRouter.post('/posts/generate', async (c) => {
  const userId = await getUserIdFromRequest(c.req.raw, c.env);
  if (!userId) return c.json({ error: 'Unauthorized' }, 401);

  const authResult = await authorizeFeature(userId, 'maxGenerationsPerDay', c.env, c.req.raw);
  if (!authResult.authorized) return c.json({ error: authResult.reason }, 403);

  let body: GenerateRequest;
  try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON' }, 400); }
  if (!body.topic) return c.json({ error: 'topic is required' }, 400);

  // Inject brand voice guidelines from the active page's latest AI analysis if available
  try {
    const activePage = await c.env.DB
      .prepare('SELECT id FROM pages WHERE user_id = ? AND is_active = 1')
      .bind(userId)
      .first<{ id: string }>();

    if (activePage) {
      const latestAnalysis = await c.env.DB
        .prepare('SELECT writing_style FROM page_analyses WHERE page_id = ? ORDER BY analyzed_at DESC LIMIT 1')
        .bind(activePage.id)
        .first<{ writing_style: string }>();
      if (latestAnalysis?.writing_style) {
        body.brandVoice = latestAnalysis.writing_style;
      }
    }
  } catch (err) {
    console.error('Failed to retrieve brand voice analysis:', err);
  }

  try {
    const result = await generatePostContent(body, c.env.DEEPSEEK_API_KEY);

    const genId = crypto.randomUUID();
    await c.env.DB
      .prepare(
        `INSERT INTO generations (id, user_id, topic, hook_type, formula, tone, post_format, generated_content, variants, token_usage)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(genId, userId, body.topic, result.selectedHook, result.formulaApplied,
        body.tone, body.postFormat ?? 'Post', result.content,
        JSON.stringify(result.variants), result.tokenUsage ? JSON.stringify(result.tokenUsage) : null)
      .run();

    return c.json({ ...result, generationId: genId });
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : 'Generation failed' }, 500);
  }
});
