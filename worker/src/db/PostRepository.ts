export interface PostRow {
  id: string;
  page_id: string;
  facebook_post_id: string | null;
  permalink: string | null;
  message: string;
  media_url: string | null;
  post_format: string;
  hook_type: string | null;
  copywriting_formula: string | null;
  tone: string | null;
  status: string;
  scheduled_for: number | null;
  created_at: number;
  published_at: number | null;
  user_id: string;
  campaign_id: string | null;
  generation_id: string | null;
  likes: number;
  comments_count: number;
  shares: number;
  views: number;
  engagement_fetched_at: number | null;
  last_synced_at: number | null;
  page_name?: string;
  campaign_title?: string;
  campaign_color?: string;
}

export interface CommentRow {
  id: string;
  facebook_comment_id: string;
  post_id: string;
  from_name: string | null;
  from_id: string | null;
  message: string;
  like_count: number;
  created_time: number | null;
  parent_id: string | null;
  fetched_at: number;
}

export interface PostListParams {
  status?: string;
  pageId?: string;
  campaignId?: string;
  sortBy?: string;
  limit?: number;
  offset?: number;
}

export class PostRepository {
  static async listPosts(db: D1Database, userId: string, params: PostListParams = {}): Promise<PostRow[]> {
    const { status, pageId, campaignId, sortBy = 'latest', limit = 20, offset = 0 } = params;
    
    let query = `
      SELECT p.*, pg.name as page_name, cmp.title as campaign_title, cmp.color as campaign_color 
      FROM posts p 
      JOIN pages pg ON p.page_id = pg.id 
      LEFT JOIN campaigns cmp ON p.campaign_id = cmp.id
      WHERE p.user_id = ?
    `;
    const binds: unknown[] = [userId];

    if (status) {
      query += ' AND p.status = ?';
      binds.push(status);
    }
    if (pageId) {
      query += ' AND p.page_id = ?';
      binds.push(pageId);
    }
    if (campaignId) {
      query += ' AND p.campaign_id = ?';
      binds.push(campaignId);
    }

    let orderBy = 'p.created_at DESC';
    if (sortBy === 'likes') orderBy = 'p.likes DESC';
    else if (sortBy === 'comments') orderBy = 'p.comments_count DESC';
    else if (sortBy === 'shares') orderBy = 'p.shares DESC';
    else if (sortBy === 'views') orderBy = 'p.views DESC';
    else if (sortBy === 'engagement') orderBy = '(p.likes + p.comments_count + p.shares) DESC';

    query += ` ORDER BY ${orderBy} LIMIT ? OFFSET ?`;
    binds.push(limit, offset);

    const rows = await db.prepare(query).bind(...binds).all<PostRow>();
    return rows.results ?? [];
  }

  static async findByIdAndUser(db: D1Database, id: string, userId: string): Promise<PostRow | null> {
    return db
      .prepare(`
        SELECT p.*, pg.name as page_name, cmp.title as campaign_title, cmp.color as campaign_color 
        FROM posts p
        JOIN pages pg ON p.page_id = pg.id
        LEFT JOIN campaigns cmp ON p.campaign_id = cmp.id
        WHERE p.id = ? AND p.user_id = ?
      `)
      .bind(id, userId)
      .first<PostRow>();
  }

  static async createPost(db: D1Database, post: Partial<PostRow>): Promise<void> {
    const fields = [
      'id', 'page_id', 'facebook_post_id', 'permalink', 'message', 'media_url',
      'hook_type', 'copywriting_formula', 'tone', 'post_format', 'status',
      'scheduled_for', 'created_at', 'published_at', 'user_id', 'campaign_id', 'generation_id'
    ];
    const placeholders = fields.map(() => '?').join(', ');
    const binds = fields.map(f => (post as any)[f] ?? null);

    await db
      .prepare(`INSERT INTO posts (${fields.join(', ')}) VALUES (${placeholders})`)
      .bind(...binds)
      .run();
  }

  static async createPostComment(
    db: D1Database,
    comment: Omit<CommentRow, 'fetched_at'>
  ): Promise<void> {
    await db
      .prepare(`
        INSERT INTO post_comments(id, facebook_comment_id, post_id, from_name, from_id, message, like_count, created_time, parent_id, fetched_at)
        VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, unixepoch())
      `)
      .bind(
        comment.id,
        comment.facebook_comment_id,
        comment.post_id,
        comment.from_name,
        comment.from_id,
        comment.message,
        comment.like_count ?? 0,
        comment.created_time,
        comment.parent_id
      )
      .run();
  }

  static async incrementCommentsCount(db: D1Database, postId: string): Promise<void> {
    await db
      .prepare('UPDATE posts SET comments_count = comments_count + 1 WHERE id = ?')
      .bind(postId)
      .run();
  }

  static async decrementCommentsCount(db: D1Database, postId: string): Promise<void> {
    await db
      .prepare('UPDATE posts SET comments_count = MAX(0, comments_count - 1) WHERE id = ?')
      .bind(postId)
      .run();
  }

  static async getComments(db: D1Database, postId: string): Promise<{ comments: CommentRow[]; replies: CommentRow[] }> {
    const commentsRes = await db
      .prepare('SELECT * FROM post_comments WHERE post_id=? AND parent_id IS NULL ORDER BY created_time DESC LIMIT 100')
      .bind(postId)
      .all<CommentRow>();
    const repliesRes = await db
      .prepare('SELECT * FROM post_comments WHERE post_id=? AND parent_id IS NOT NULL ORDER BY created_time ASC')
      .bind(postId)
      .all<CommentRow>();
    return {
      comments: commentsRes.results ?? [],
      replies: repliesRes.results ?? []
    };
  }

  static async findCommentByFbIdAndPost(db: D1Database, commentId: string, postId: string): Promise<CommentRow | null> {
    return db
      .prepare('SELECT id, facebook_comment_id FROM post_comments WHERE id = ? AND post_id = ?')
      .bind(commentId, postId)
      .first<CommentRow>();
  }

  static async deletePostAndComments(db: D1Database, postId: string): Promise<void> {
    await db.batch([
      db.prepare('DELETE FROM post_comments WHERE post_id = ?').bind(postId),
      db.prepare('DELETE FROM posts WHERE id = ?').bind(postId),
    ]);
  }

  static async deleteComment(db: D1Database, commentId: string): Promise<void> {
    await db.prepare('DELETE FROM post_comments WHERE id = ?').bind(commentId).run();
  }

  static async saveGeneration(
    db: D1Database,
    generation: {
      id: string;
      userId: string;
      topic: string;
      hookType: string;
      formula: string;
      tone: string;
      postFormat: string;
      generatedContent: string;
      variants: string;
      tokenUsage: string | null;
    }
  ): Promise<void> {
    await db
      .prepare(`
        INSERT INTO generations (id, user_id, topic, hook_type, formula, tone, post_format, generated_content, variants, token_usage)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .bind(
        generation.id,
        generation.userId,
        generation.topic,
        generation.hookType,
        generation.formula,
        generation.tone,
        generation.postFormat,
        generation.generatedContent,
        generation.variants,
        generation.tokenUsage
      )
      .run();
  }

  static async getSyncDashboardStats(db: D1Database, userId: string) {
    const [pc, es, ls] = await Promise.all([
      db.prepare("SELECT COUNT(*) as c FROM posts WHERE user_id=? AND status='Published'").bind(userId).first<{ c: number }>(),
      db.prepare('SELECT COALESCE(SUM(likes),0) tl, COALESCE(SUM(comments_count),0) tc, COALESCE(SUM(shares),0) ts, COALESCE(SUM(views),0) tv FROM posts WHERE user_id=?').bind(userId).first<{ tl: number; tc: number; ts: number; tv: number }>(),
      db.prepare('SELECT MAX(last_synced_at) ls FROM posts WHERE user_id=?').bind(userId).first<{ ls: number | null }>(),
    ]);
    return {
      totalPosts: pc?.c ?? 0,
      engagement: es ?? { tl: 0, tc: 0, ts: 0, tv: 0 },
      lastSyncAt: ls?.ls ?? null
    };
  }

  static async findPostByFacebookIdAndPage(db: D1Database, facebookPostId: string, pageId: string): Promise<PostRow | null> {
    return db
      .prepare('SELECT id, facebook_post_id FROM posts WHERE facebook_post_id = ? AND page_id = ?')
      .bind(facebookPostId, pageId)
      .first<PostRow>();
  }

  static async findPostByFacebookId(db: D1Database, facebookPostId: string): Promise<PostRow | null> {
    return db
      .prepare('SELECT id, facebook_post_id FROM posts WHERE facebook_post_id = ?')
      .bind(facebookPostId)
      .first<PostRow>();
  }

  static async findExistingPostsByFbIds(db: D1Database, ids: string[], pageId: string): Promise<Map<string, string>> {
    if (ids.length === 0) return new Map();
    const ph = ids.map(() => '?').join(',');
    const rows = await db
      .prepare(`SELECT id, facebook_post_id FROM posts WHERE facebook_post_id IN (${ph}) AND page_id=?`)
      .bind(...ids, pageId)
      .all<{ id: string; facebook_post_id: string }>();
    return new Map(rows.results?.map(r => [r.facebook_post_id, r.id]) ?? []);
  }

  static async findExistingCommentsByFbIds(db: D1Database, ids: string[]): Promise<Set<string>> {
    if (ids.length === 0) return new Set();
    const ph = ids.map(() => '?').join(',');
    const rows = await db
      .prepare(`SELECT facebook_comment_id FROM post_comments WHERE facebook_comment_id IN (${ph})`)
      .bind(...ids)
      .all<{ facebook_comment_id: string }>();
    return new Set(rows.results?.map(r => r.facebook_comment_id) ?? []);
  }

  static async getLocalCommentsByPostId(db: D1Database, postId: string): Promise<string[]> {
    const rows = await db
      .prepare('SELECT facebook_comment_id FROM post_comments WHERE post_id=?')
      .bind(postId)
      .all<{ facebook_comment_id: string }>();
    return rows.results?.map(r => r.facebook_comment_id) ?? [];
  }
}
