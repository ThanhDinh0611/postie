// ─── Sync Utility Functions ───────────────────────────────────────────────────
// Pure functions for post sync logic. No side effects.

export interface SyncResult {
  postId: string;
  facebookPostId: string | null;
  message: string;
  pageName: string;
  status: string;
  engagement: {
    likes: number;
    comments: number;
    shares: number;
    views: number;
  } | null;
  syncedAt: number;
}

export interface EngagementStats {
  totalPosts: number;
  totalLikes: number;
  totalComments: number;
  totalShares: number;
  totalViews: number;
  avgLikes: number;
  avgComments: number;
  avgShares: number;
  avgViews: number;
}

export function computeEngagementStats(
  results: SyncResult[],
): EngagementStats {
  const published = results.filter((r) => r.engagement !== null);
  const count = published.length;
  if (count === 0) {
    return {
      totalPosts: 0, totalLikes: 0, totalComments: 0,
      totalShares: 0, totalViews: 0,
      avgLikes: 0, avgComments: 0, avgShares: 0, avgViews: 0,
    };
  }

  const sum = published.reduce(
    (acc, r) => ({
      likes: acc.likes + (r.engagement?.likes ?? 0),
      comments: acc.comments + (r.engagement?.comments ?? 0),
      shares: acc.shares + (r.engagement?.shares ?? 0),
      views: acc.views + (r.engagement?.views ?? 0),
    }),
    { likes: 0, comments: 0, shares: 0, views: 0 },
  );

  return {
    totalPosts: published.length,
    totalLikes: sum.likes,
    totalComments: sum.comments,
    totalShares: sum.shares,
    totalViews: sum.views,
    avgLikes: Math.round(sum.likes / count),
    avgComments: Math.round(sum.comments / count),
    avgShares: Math.round(sum.shares / count),
    avgViews: Math.round(sum.views / count),
  };
}

export function formatSyncDuration(start: number): string {
  const elapsed = Date.now() - start;
  const seconds = Math.floor(elapsed / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ${seconds % 60}s`;
}

export function calculateEngagementRate(likes: number, comments: number, shares: number, views: number): number {
  const total = views || 1;
  return Number((((likes + comments * 2 + shares * 3) / total) * 100).toFixed(2));
}
