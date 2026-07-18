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
}
