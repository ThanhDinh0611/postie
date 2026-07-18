import { getPostComments, getPagePosts, batchGetPostEngagements } from '../core/facebook.ts';
import { PostRepository } from '../db/PostRepository.ts';
import { PageRepository } from '../db/PageRepository.ts';
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
      
      // Batch check existing comments
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
        const deletePh = toDelete.map(() => '?').join(',');
        statements.push(db.prepare(`DELETE FROM post_comments WHERE facebook_comment_id IN (${deletePh})`).bind(...toDelete));
      }

      for (const comment of fbComments) {
        if (!existingSet.has(comment.id)) {
          statements.push(db.prepare(`
            INSERT INTO post_comments(id, facebook_comment_id, post_id, from_name, from_id, message, like_count, created_time, fetched_at) 
            VALUES(?, ?, ?, ?, ?, ?, ?, ?, unixepoch())
          `).bind(
            crypto.randomUUID(),
            comment.id,
            postId,
            comment.from?.name ?? null,
            comment.from?.id ?? null,
            comment.message ?? '',
            comment.like_count ?? 0,
            comment.created_time ? Math.floor(new Date(comment.created_time).getTime() / 1000) : null
          ));
        }

        if (comment.comments?.data) {
          for (const reply of comment.comments.data) {
            if (!existingSet.has(reply.id)) {
              statements.push(db.prepare(`
                INSERT INTO post_comments(id, facebook_comment_id, post_id, from_name, from_id, message, like_count, created_time, parent_id, fetched_at) 
                VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, unixepoch())
              `).bind(
                crypto.randomUUID(),
                reply.id,
                postId,
                reply.from?.name ?? null,
                reply.from?.id ?? null,
                reply.message ?? '',
                reply.like_count ?? 0,
                reply.created_time ? Math.floor(new Date(reply.created_time).getTime() / 1000) : null,
                comment.id
              ));
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
        
        if (engagement) {
          statements.push(db.prepare(`
            UPDATE posts 
            SET last_synced_at=unixepoch(),
                likes=?, comments_count=?, shares=?, views=?, engagement_fetched_at=unixepoch() 
            WHERE id=?
          `).bind(engagement.likes, engagement.comments, engagement.shares, engagement.views, postId));
        } else {
          statements.push(db.prepare('UPDATE posts SET last_synced_at=unixepoch() WHERE id=?').bind(postId));
        }
      } else {
        postId = crypto.randomUUID();
        const pubAt = p.created_time ? Math.floor(new Date(p.created_time).getTime() / 1000) : null;
        
        if (engagement) {
          statements.push(db.prepare(`
            INSERT INTO posts(id, page_id, facebook_post_id, permalink, message, post_format, status, created_at, published_at, user_id, last_synced_at, likes, comments_count, shares, views, engagement_fetched_at) 
            VALUES(?, ?, ?, ?, ?, 'Post', 'Published', ?, ?, ?, unixepoch(), ?, ?, ?, ?, unixepoch())
          `).bind(
            postId, page.id, p.id, p.permalink_url ?? null, p.message ?? '',
            pubAt ?? Math.floor(Date.now() / 1000), pubAt, userId,
            engagement.likes, engagement.comments, engagement.shares, engagement.views
          ));
        } else {
          statements.push(db.prepare(`
            INSERT INTO posts(id, page_id, facebook_post_id, permalink, message, post_format, status, created_at, published_at, user_id, last_synced_at) 
            VALUES(?, ?, ?, ?, ?, 'Post', 'Published', ?, ?, ?, unixepoch())
          `).bind(
            postId, page.id, p.id, p.permalink_url ?? null, p.message ?? '',
            pubAt ?? Math.floor(Date.now() / 1000), pubAt, userId
          ));
        }
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

    const item = val.item; // 'post', 'comment', 'status', etc.
    const verb = val.verb; // 'add', 'edited', 'remove', etc.

    // Get the page and user mapped to this page id
    const page = await db
      .prepare('SELECT id, user_id FROM pages WHERE facebook_page_id = ?')
      .bind(facebookPageId)
      .first<{ id: string; user_id: string }>();

    if (!page) {
      console.log(`Webhook Page Not Found for facebookPageId: ${facebookPageId}`);
      return statements;
    }

    if (item === 'post' || item === 'status' || item === 'photo' || item === 'video') {
      let facebookPostId = val.post_id || val.id;
      if (!facebookPostId) return statements;

      if (!facebookPostId.includes('_')) {
        facebookPostId = `${facebookPageId}_${facebookPostId}`;
      }

      if (verb === 'add') {
        const existing = await PostRepository.findPostByFacebookId(db, facebookPostId);
        if (!existing) {
          const postId = crypto.randomUUID();
          const message = val.message || '';
          
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

          const postShortId = facebookPostId.split('_')[1] || facebookPostId;
          const permalink = `https://www.facebook.com/${facebookPageId}/posts/${postShortId}`;

          statements.push(db.prepare(`
            INSERT INTO posts(id, page_id, facebook_post_id, permalink, message, post_format, status, created_at, published_at, user_id, last_synced_at)
            VALUES(?, ?, ?, ?, ?, 'Post', 'Published', ?, ?, ?, unixepoch())
          `).bind(postId, page.id, facebookPostId, permalink, message, createdTime, createdTime, page.user_id));
        }
      } else if (verb === 'edited') {
        const message = val.message || '';
        statements.push(db.prepare('UPDATE posts SET message = ?, last_synced_at = unixepoch() WHERE facebook_post_id = ?').bind(message, facebookPostId));
      } else if (verb === 'remove') {
        statements.push(db.prepare("UPDATE posts SET status = 'Deleted', last_synced_at = unixepoch() WHERE facebook_post_id = ?").bind(facebookPostId));
      }
    } else if (item === 'comment') {
      const facebookCommentId = val.comment_id || val.id;
      let facebookPostId = val.post_id;
      
      if (facebookPostId && !facebookPostId.includes('_')) {
        facebookPostId = `${facebookPageId}_${facebookPostId}`;
      } else if (!facebookPostId && facebookCommentId) {
        const parts = facebookCommentId.split('_');
        if (parts.length >= 2) {
          facebookPostId = `${parts[0]}_${parts[1]}`;
        }
      }

      if (!facebookCommentId || !facebookPostId) return statements;

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

            statements.push(db.prepare(`
              INSERT INTO post_comments(id, facebook_comment_id, post_id, from_name, from_id, message, created_time, parent_id, fetched_at)
              VALUES(?, ?, ?, ?, ?, ?, ?, ?, unixepoch())
            `).bind(commentId, facebookCommentId, post.id, fromName, fromId, message, createdTime, parentId));

            statements.push(db.prepare('UPDATE posts SET comments_count = comments_count + 1 WHERE id = ?').bind(post.id));
          }
        }
      } else if (verb === 'edited') {
        const message = val.message || '';
        statements.push(db.prepare('UPDATE post_comments SET message = ? WHERE facebook_comment_id = ?').bind(message, facebookCommentId));
      } else if (verb === 'remove') {
        statements.push(db.prepare('DELETE FROM post_comments WHERE facebook_comment_id = ?').bind(facebookCommentId));

        const post = await PostRepository.findPostByFacebookId(db, facebookPostId);
        if (post) {
          statements.push(db.prepare('UPDATE posts SET comments_count = MAX(0, comments_count - 1) WHERE id = ?').bind(post.id));
        }
      }
    }

    return statements;
  }
}
