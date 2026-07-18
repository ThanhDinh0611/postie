import { getPostComments, getPagePosts, batchGetPostEngagements } from '../core/facebook.ts';
import { PostRepository } from '../db/PostRepository.ts';
import { computeEngagementStats, formatSyncDuration, type SyncResult } from '../features/sync/sync.utils.ts';

export class SyncService {
  static async syncComments(
    db: D1Database,
    accessToken: string,
    postId: string,
    facebookPostId: string
  ): Promise<{ totalCount: number }> {
    try {
      const fbComments = await getPostComments(accessToken, facebookPostId);
      
      const ids: string[] = [];
      for (const comment of fbComments) {
        ids.push(comment.id);
        if (comment.comments?.data) {
          for (const reply of comment.comments.data) {
            ids.push(reply.id);
          }
        }
      }

      const existingSet = await PostRepository.findExistingCommentsByFbIds(db, ids);
      const localComments = await PostRepository.getLocalCommentsByPostId(db, postId);

      const activeIdsSet = new Set(ids);
      const toDelete: string[] = [];
      for (const lc of localComments) {
        if (!activeIdsSet.has(lc)) {
          toDelete.push(lc);
        }
      }

      const statements: D1PreparedStatement[] = [];
      
      if (toDelete.length > 0) {
        statements.push(PostRepository.getDeleteCommentsBatchStatement(db, toDelete));
      }

      for (const comment of fbComments) {
        if (!existingSet.has(comment.id)) {
          statements.push(PostRepository.getInsertCommentStatement(db, {
            id: crypto.randomUUID(),
            facebook_comment_id: comment.id,
            post_id: postId,
            from_name: comment.from?.name ?? null,
            from_id: comment.from?.id ?? null,
            message: comment.message ?? '',
            like_count: comment.like_count ?? 0,
            created_time: comment.created_time ? Math.floor(new Date(comment.created_time).getTime() / 1000) : null
          }));
        }

        if (comment.comments?.data) {
          for (const reply of comment.comments.data) {
            if (!existingSet.has(reply.id)) {
              statements.push(PostRepository.getInsertCommentStatement(db, {
                id: crypto.randomUUID(),
                facebook_comment_id: reply.id,
                post_id: postId,
                from_name: reply.from?.name ?? null,
                from_id: reply.from?.id ?? null,
                message: reply.message ?? '',
                like_count: reply.like_count ?? 0,
                created_time: reply.created_time ? Math.floor(new Date(reply.created_time).getTime() / 1000) : null,
                parent_id: comment.id
              }));
            }
          }
        }
      }

      if (statements.length > 0) {
        await db.batch(statements);
      }
    } catch (err) {
      console.error('Failed to sync comments:', err);
    }

    const localData = await PostRepository.getComments(db, postId);
    return {
      totalCount: localData.comments.length + localData.replies.length
    };
  }

  static async syncPagePosts(
    db: D1Database,
    userId: string,
    page: { id: string; facebook_page_id: string; name: string; access_token: string },
    maxPosts: number
  ): Promise<{ results: SyncResult[]; statements: D1PreparedStatement[] }> {
    const results: SyncResult[] = [];
    const statements: D1PreparedStatement[] = [];

    const fbPosts = await getPagePosts(page.access_token, page.facebook_page_id, maxPosts);
    if (!fbPosts.length) return { results, statements };

    const ids = fbPosts.map(p => p.id);
    const existingMap = await PostRepository.findExistingPostsByFbIds(db, ids, page.id);

    const toProcess = fbPosts.map(p => ({
      ...p,
      isNew: !existingMap.has(p.id)
    }));

    const engagementMap = await batchGetPostEngagements(page.access_token, toProcess.map(p => p.id));

    for (const p of toProcess) {
      const engagement = engagementMap.get(p.id) ?? null;
      let postId: string;

      if (!p.isNew) {
        const existingId = existingMap.get(p.id);
        if (!existingId) continue;
        postId = existingId;
        
        statements.push(PostRepository.getUpdatePostEngagementStatement(db, postId, engagement));
      } else {
        postId = crypto.randomUUID();
        const pubAt = p.created_time ? Math.floor(new Date(p.created_time).getTime() / 1000) : null;
        
        statements.push(PostRepository.getInsertPostStatement(db, {
          id: postId,
          page_id: page.id,
          facebook_post_id: p.id,
          permalink: p.permalink_url ?? null,
          message: p.message ?? '',
          post_format: 'Post',
          status: 'Published',
          created_at: pubAt ?? Math.floor(Date.now() / 1000),
          published_at: pubAt,
          user_id: userId,
          likes: engagement?.likes,
          comments_count: engagement?.comments,
          shares: engagement?.shares,
          views: engagement?.views,
          engagement_fetched_at: engagement ? Math.floor(Date.now() / 1000) : undefined
        }));
      }

      results.push({
        postId,
        facebookPostId: p.id,
        message: (p.message ?? '').slice(0, 100),
        pageName: page.name,
        status: 'Published',
        engagement,
        syncedAt: Math.floor(Date.now() / 1000)
      });
    }

    return { results, statements };
  }

  static async handleWebhookFeedChange(
    db: D1Database,
    facebookPageId: string,
    changeValue: any
  ): Promise<D1PreparedStatement[]> {
    const statements: D1PreparedStatement[] = [];
    const val = changeValue;
    if (!val) return statements;

    const item = val.item; // 'post', 'comment', 'status', 'photo', 'video', 'reaction', 'like', 'share'
    const verb = val.verb; // 'add', 'edited', 'remove'

    const page = await db
      .prepare('SELECT id, user_id FROM pages WHERE facebook_page_id = ?')
      .bind(facebookPageId)
      .first<{ id: string; user_id: string }>();

    if (!page) {
      console.log(`Webhook Page Not Found for facebookPageId: ${facebookPageId}`);
      return statements;
    }

    const facebookPostId = this.getNormalizedPostId(val, item, facebookPageId);

    switch (item) {
      case 'comment':
        if (facebookPostId) {
          await this.handleWebhookCommentItem(db, facebookPostId, val, verb, statements);
        }
        break;
      case 'post':
      case 'status':
      case 'photo':
      case 'video':
      case 'reaction':
      case 'like':
      case 'share':
        // NO-OP: Ignore high-frequency / non-conversation events to prevent D1 write locks.
        // These updates are synced on-demand/periodically from the Dashboard.
        break;
    }

    return statements;
  }

  private static getNormalizedPostId(val: any, item: string, facebookPageId: string): string | null {
    let id = val.post_id;
    if (!id && item !== 'comment') {
      id = val.id;
    }
    if (id) {
      return id.includes('_') ? id : `${facebookPageId}_${id}`;
    }
    if (item === 'comment') {
      const commentId = val.comment_id || val.id;
      const parts = (commentId || '').split('_');
      if (parts.length >= 2) {
        return `${parts[0]}_${parts[1]}`;
      }
    }
    return null;
  }

  private static async handleWebhookCommentItem(
    db: D1Database,
    facebookPostId: string,
    val: any,
    verb: string,
    statements: D1PreparedStatement[]
  ): Promise<void> {
    const facebookCommentId = val.comment_id || val.id;
    if (!facebookCommentId) return;

    if (verb === 'add') {
      const post = await PostRepository.findPostByFacebookId(db, facebookPostId);
      if (post) {
        const existing = await db
          .prepare('SELECT id FROM post_comments WHERE facebook_comment_id = ?')
          .bind(facebookCommentId)
          .first();

        if (!existing) {
          const commentId = crypto.randomUUID();
          const message = val.message || '';
          const fromName = val.sender_name || null;
          const fromId = val.sender_id || null;

          let createdTime = Math.floor(Date.now() / 1000);
          if (val.created_time) {
            if (typeof val.created_time === 'number') {
              createdTime = val.created_time;
            } else if (!isNaN(Number(val.created_time))) {
              createdTime = Number(val.created_time);
            } else {
              const parsedDate = new Date(val.created_time);
              if (!isNaN(parsedDate.getTime())) {
                createdTime = Math.floor(parsedDate.getTime() / 1000);
              }
            }
          }

          const parentId = val.parent_id || null;

          statements.push(PostRepository.getInsertCommentStatement(db, {
            id: commentId,
            facebook_comment_id: facebookCommentId,
            post_id: post.id,
            from_name: fromName,
            from_id: fromId,
            message,
            created_time: createdTime,
            parent_id: parentId
          }));

          statements.push(PostRepository.getUpdatePostCommentsCountStatement(db, post.id, 1));
        }
      }
    } else if (verb === 'edited') {
      const message = val.message || '';
      statements.push(PostRepository.getUpdateCommentMessageStatement(db, facebookCommentId, message));
    } else if (verb === 'remove') {
      statements.push(PostRepository.getDeleteCommentStatement(db, facebookCommentId));

      const post = await PostRepository.findPostByFacebookId(db, facebookPostId);
      if (post) {
        statements.push(PostRepository.getUpdatePostCommentsCountStatement(db, post.id, -1));
      }
    }
  }
}
