import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { getUserIdFromRequest, authorizeFeature } from '../../core/auth.ts';
import { generatePostContent, generateCommentContent } from '../../core/ai.ts';
import { publishPost, publishReel, buildPermalink, clearFacebookCache, createPostComment, deleteFacebookPost, deleteFacebookComment } from '../../core/facebook.ts';
import { PageRepository } from '../../db/PageRepository.ts';
import { PostRepository } from '../../db/PostRepository.ts';
import { ClipyService } from '../../services/ClipyService.ts';
import {
  publishPostSchema,
  generatePostSchema,
  createCommentSchema,
  generateCommentSchema,
  publishReelSchema
} from './posts.schemas.ts';

export const postsRouter = new Hono<{ Bindings: Env }>();

// POST /api/posts/publish — Publish a post to Facebook
postsRouter.post('/posts/publish', zValidator('json', publishPostSchema), async (c) => {
  const userId = await getUserIdFromRequest(c.req.raw, c.env);
  if (!userId) return c.json({ error: 'Unauthorized' }, 401);

  const authResult = await authorizeFeature(userId, 'maxPostsPerMonth', c.env, c.req.raw);
  if (!authResult.authorized) return c.json({ error: authResult.reason }, 403);

  const body = c.req.valid('json');

  // Get specified page or fallback to active page
  let page;
  if (body.pageId) {
    page = await PageRepository.findPageByIdAndUser(c.env.DB, body.pageId, userId);
  } else {
    page = await PageRepository.findActivePageByUser(c.env.DB, userId);
  }

  if (!page) {
    return c.json({ error: 'No active Facebook page. Connect and select a page first.' }, 400);
  }

  try {
    // Generate Clipy short-link if publishing format is 'link'
    let shortUrl = '';
    if (body.publishType === 'link' && body.targetUrl) {
      shortUrl = await ClipyService.generateShortLink(
        c.env,
        body.targetUrl,
        body.linkTitle || body.content.slice(0, 60),
        body.linkDescription || 'Shared via Clipy',
        body.mediaUrl || undefined
      );
    }

    const finalContent = shortUrl ? `${body.content}\n\n👉 Chi tiết xem tại: ${shortUrl}` : body.content;
    const fbMediaUrl = body.publishType === 'image' ? (body.mediaUrl || undefined) : undefined;

    const fbResult = await publishPost(
      page.access_token,
      page.facebook_page_id,
      finalContent,
      fbMediaUrl,
      body.scheduledAt || undefined,
      shortUrl || undefined
    );
    const permalink = buildPermalink(page.username ?? page.facebook_page_id, fbResult.id);

    const postId = crypto.randomUUID();
    await PostRepository.createPost(c.env.DB, {
      id: postId,
      page_id: page.id,
      facebook_post_id: fbResult.id,
      permalink,
      message: finalContent,
      media_url: body.mediaUrl || null,
      hook_type: body.hookType || null,
      copywriting_formula: body.formula || null,
      tone: body.tone || 'Friendly',
      post_format: body.postFormat || 'Post',
      status: body.scheduledAt ? 'Scheduled' : 'Published',
      scheduled_for: body.scheduledAt || null,
      published_at: body.scheduledAt ? null : Math.floor(Date.now() / 1000),
      user_id: userId,
      campaign_id: body.campaignId || null,
      generation_id: body.generationId || null,
    });

    return c.json({ postId, facebookPostId: fbResult.id, permalink, status: body.scheduledAt ? 'Scheduled' : 'Published' });
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : 'Publishing failed' }, 500);
  }
});

// POST /api/posts/publish-reel — Publish a Reel to Facebook
postsRouter.post('/posts/publish-reel', zValidator('json', publishReelSchema), async (c) => {
  const userId = await getUserIdFromRequest(c.req.raw, c.env);
  if (!userId) return c.json({ error: 'Unauthorized' }, 401);

  const authResult = await authorizeFeature(userId, 'maxPostsPerMonth', c.env, c.req.raw);
  if (!authResult.authorized) return c.json({ error: authResult.reason }, 403);

  const body = c.req.valid('json');

  // Check tier allows Reels
  const tierResult = await authorizeFeature(userId, 'allowReels', c.env, c.req.raw);
  if (!tierResult.authorized) return c.json({ error: tierResult.reason }, 403);

  let page;
  if (body.pageId) {
    page = await PageRepository.findPageByIdAndUser(c.env.DB, body.pageId, userId);
  } else {
    page = await PageRepository.findActivePageByUser(c.env.DB, userId);
  }

  if (!page) {
    return c.json({ error: 'No active Facebook page. Connect and select a page first.' }, 400);
  }

  try {
    const fbResult = await publishReel(
      page.access_token,
      page.facebook_page_id,
      body.videoUrl,
      body.caption,
      body.scheduledAt || undefined,
      body.contentCategory,
    );

    const permalink = buildPermalink(page.username ?? page.facebook_page_id, fbResult.id);

    const postId = crypto.randomUUID();
    await PostRepository.createPost(c.env.DB, {
      id: postId,
      page_id: page.id,
      facebook_post_id: fbResult.id,
      permalink,
      message: body.caption,
      media_url: body.videoUrl || null,
      hook_type: body.hookType || null,
      copywriting_formula: body.formula || null,
      tone: body.tone || 'Friendly',
      post_format: 'Reel',
      status: body.scheduledAt ? 'Scheduled' : 'Published',
      scheduled_for: body.scheduledAt || null,
      published_at: body.scheduledAt ? null : Math.floor(Date.now() / 1000),
      user_id: userId,
      campaign_id: body.campaignId || null,
      generation_id: body.generationId || null,
      reel_duration: body.reelDuration || null,
      video_url: body.videoUrl || null,
      script_segments: body.scriptSegments || null,
    });

    return c.json({ postId, facebookPostId: fbResult.id, permalink, status: body.scheduledAt ? 'Scheduled' : 'Published' });
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : 'Reel publishing failed' }, 500);
  }
});

// GET /api/posts — List user's posts
postsRouter.get('/posts', async (c) => {
  const userId = await getUserIdFromRequest(c.req.raw, c.env);
  if (!userId) return c.json({ error: 'Unauthorized' }, 401);

  const { status, pageId, campaignId, format, sortBy = 'latest', limit = '20', offset = '0' } = c.req.query();
  try {
    const posts = await PostRepository.listPosts(c.env.DB, userId, {
      status: status || undefined,
      pageId: pageId || undefined,
      campaignId: campaignId || undefined,
      format: format || undefined,
      sortBy,
      limit: Number(limit),
      offset: Number(offset)
    });
    return c.json(posts);
  } catch (err) {
    return c.json({ error: 'Failed to fetch posts' }, 500);
  }
});

// POST /api/posts/:id/clear-cache — Clear Facebook/Zalo cache for a post link
postsRouter.post('/posts/:id/clear-cache', async (c) => {
  const userId = await getUserIdFromRequest(c.req.raw, c.env);
  if (!userId) return c.json({ error: 'Unauthorized' }, 401);

  const postId = c.req.param('id');
  try {
    const post = await PostRepository.findByIdAndUser(c.env.DB, postId, userId);
    if (!post || !post.permalink) {
      return c.json({ error: 'Post not found or not published' }, 404);
    }

    const page = await PageRepository.findPageByIdAndUser(c.env.DB, post.page_id, userId);
    if (!page) {
      return c.json({ error: 'Page access token not found' }, 404);
    }

    const results: Record<string, string> = {};
    try {
      await clearFacebookCache(page.access_token, post.permalink);
      results.facebook = 'success';
    } catch (e) {
      results.facebook = `failed: ${e instanceof Error ? e.message : String(e)}`;
    }

    return c.json({ success: true, url: post.permalink, results });
  } catch (err) {
    return c.json({ error: 'Failed to clear cache' }, 500);
  }
});

// POST /api/posts/generate — AI generate post content
postsRouter.post('/posts/generate', zValidator('json', generatePostSchema), async (c) => {
  const userId = await getUserIdFromRequest(c.req.raw, c.env);
  if (!userId) return c.json({ error: 'Unauthorized' }, 401);

  const authResult = await authorizeFeature(userId, 'maxGenerationsPerDay', c.env, c.req.raw);
  if (!authResult.authorized) return c.json({ error: authResult.reason }, 403);

  const body = c.req.valid('json');

  // Inject brand voice guidelines from the active page's latest AI analysis if available
  let brandVoice: string | undefined;
  try {
    const activePage = await PageRepository.findActivePageByUser(c.env.DB, userId);
    if (activePage) {
      const latestAnalysis = await PageRepository.getLatestAnalysis(c.env.DB, activePage.id, userId);
      if (latestAnalysis?.writing_style) {
        brandVoice = latestAnalysis.writing_style;
      }
    }
  } catch (err) {
    console.error('Failed to retrieve brand voice analysis:', err);
  }

  try {
    const result = await generatePostContent({ ...body, brandVoice }, c.env.DEEPSEEK_API_KEY);

    const genId = crypto.randomUUID();
    await PostRepository.saveGeneration(c.env.DB, {
      id: genId,
      userId,
      topic: body.topic,
      hookType: result.selectedHook,
      formula: result.formulaApplied,
      tone: body.tone,
      postFormat: body.postFormat ?? 'Post',
      generatedContent: result.content,
      variants: JSON.stringify(result.variants),
      tokenUsage: result.tokenUsage ? JSON.stringify(result.tokenUsage) : null
    });

    return c.json({ ...result, generationId: genId });
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : 'Generation failed' }, 500);
  }
});

// POST /api/posts/:id/comments — Add a comment to a post using the Page account
postsRouter.post('/posts/:id/comments', zValidator('json', createCommentSchema), async (c) => {
  const userId = await getUserIdFromRequest(c.req.raw, c.env);
  if (!userId) return c.json({ error: 'Unauthorized' }, 401);

  const postId = c.req.param('id');
  const body = c.req.valid('json');

  try {
    const post = await PostRepository.findByIdAndUser(c.env.DB, postId, userId);
    if (!post) return c.json({ error: 'Post not found' }, 404);
    if (!post.facebook_post_id) return c.json({ error: 'Cannot comment on an unpublished post' }, 400);

    const page = await PageRepository.findPageByIdAndUser(c.env.DB, post.page_id, userId);
    if (!page) return c.json({ error: 'Page not found for this post' }, 404);

    const result = await createPostComment(page.access_token, post.facebook_post_id, body.message, body.attachmentUrl || undefined);

    // Increment comments count locally
    await PostRepository.incrementCommentsCount(c.env.DB, postId);

    return c.json({ success: true, facebookCommentId: result.id });
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : 'Failed to post comment' }, 500);
  }
});

// POST /api/posts/:id/comments/generate — Generate AI comment content (with optional Clipy link)
postsRouter.post('/posts/:id/comments/generate', zValidator('json', generateCommentSchema), async (c) => {
  const userId = await getUserIdFromRequest(c.req.raw, c.env);
  if (!userId) return c.json({ error: 'Unauthorized' }, 401);

  const postId = c.req.param('id');
  const body = c.req.valid('json');

  try {
    const post = await PostRepository.findByIdAndUser(c.env.DB, postId, userId);
    if (!post) return c.json({ error: 'Post not found' }, 404);

    const aiResult = await generateCommentContent(post.message, c.env.DEEPSEEK_API_KEY);
    let commentText = aiResult.comment;

    // Handle Clipy link generation if requested
    if (body.useClipy && body.targetUrl) {
      const shortUrl = await ClipyService.generateShortLink(
        c.env,
        body.targetUrl,
        body.linkTitle || 'Explore Link',
        body.linkDescription || 'Shared via Clipy',
        body.imageUrl || undefined
      );
      commentText = `${commentText}\n\n👉 Xem ngay: ${shortUrl}`;
    }

    return c.json({ comment: commentText });
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : 'Comment generation failed' }, 500);
  }
});

// DELETE /api/posts/:id — Delete a post from Facebook and local D1 database
postsRouter.delete('/posts/:id', async (c) => {
  const userId = await getUserIdFromRequest(c.req.raw, c.env);
  if (!userId) return c.json({ error: 'Unauthorized' }, 401);

  const postId = c.req.param('id');
  try {
    const post = await PostRepository.findByIdAndUser(c.env.DB, postId, userId);
    if (!post) return c.json({ error: 'Post not found' }, 404);

    // If published on Facebook, attempt to delete it on Facebook
    if (post.facebook_post_id) {
      const page = await PageRepository.findPageByIdAndUser(c.env.DB, post.page_id, userId);
      if (page) {
        try {
          await deleteFacebookPost(page.access_token, post.facebook_post_id);
        } catch (err) {
          console.error(`Failed to delete post ${post.facebook_post_id} from Facebook:`, err);
        }
      }
    }

    // Delete from local database
    await PostRepository.deletePostAndComments(c.env.DB, postId);
    return c.json({ success: true });
  } catch (err) {
    return c.json({ error: 'Failed to delete post' }, 500);
  }
});

// DELETE /api/posts/:id/comments/:commentId — Delete a comment from Facebook and local database
postsRouter.delete('/posts/:id/comments/:commentId', async (c) => {
  const userId = await getUserIdFromRequest(c.req.raw, c.env);
  if (!userId) return c.json({ error: 'Unauthorized' }, 401);

  const postId = c.req.param('id');
  const commentId = c.req.param('commentId');

  try {
    const post = await PostRepository.findByIdAndUser(c.env.DB, postId, userId);
    if (!post) return c.json({ error: 'Post not found' }, 404);

    // Find the comment record locally
    const comment = await PostRepository.findCommentByFbIdAndPost(c.env.DB, commentId, postId);
    if (!comment) return c.json({ error: 'Comment not found' }, 404);

    const page = await PageRepository.findPageByIdAndUser(c.env.DB, post.page_id, userId);
    if (!page) return c.json({ error: 'Page not found' }, 404);

    // Delete comment from Facebook
    try {
      await deleteFacebookComment(page.access_token, comment.facebook_comment_id);
    } catch (err) {
      return c.json({ error: err instanceof Error ? err.message : 'Failed to delete comment from Facebook' }, 500);
    }

    // Delete comment from local DB and decrement comments count
    await PostRepository.deleteComment(c.env.DB, commentId);
    await PostRepository.decrementCommentsCount(c.env.DB, postId);

    return c.json({ success: true });
  } catch (err) {
    return c.json({ error: 'Failed to delete comment' }, 500);
  }
});
