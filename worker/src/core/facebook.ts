// ─── Facebook Graph API Client ────────────────────────────────────────────────
// Lightweight client for Facebook Graph API v25.0

const GRAPH_API_BASE = 'https://graph.facebook.com/v25.0';

export interface FacebookPageInfo {
  id: string;
  name: string;
  username?: string;
  access_token: string;
  picture?: { data: { url: string } };
}

export interface FacebookPostResult {
  id: string; // format: "{page-id}_{post-id}"
  permalink_url?: string;
  created_time?: string;
}

export interface FacebookPostInfo {
  id: string;
  message?: string;
  created_time?: string;
  permalink_url?: string;
}

export interface FacebookComment {
  id: string;
  from?: { name: string; id: string };
  message?: string;
  like_count?: number;
  created_time?: string;
  comments?: { data: FacebookComment[] };
}

export interface FacebookEngagement {
  likes: number;
  comments: number;
  shares: number;
  views: number;
}

/**
 * Exchange OAuth code for a long-lived user access token.
 */
export async function exchangeCodeForToken(
  code: string,
  appId: string,
  appSecret: string,
  redirectUri: string,
): Promise<{ access_token: string }> {
  const url = `${GRAPH_API_BASE}/oauth/access_token?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&client_secret=${appSecret}&code=${code}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`OAuth token exchange failed: ${res.status}`);
  return res.json() as Promise<{ access_token: string }>;
}

/**
 * Get long-lived user access token.
 */
export async function getLongLivedToken(
  shortLivedToken: string,
  appId: string,
  appSecret: string,
): Promise<{ access_token: string; expires_in: number }> {
  const url = `${GRAPH_API_BASE}/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${shortLivedToken}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Long-lived token exchange failed: ${res.status}`);
  return res.json() as Promise<{ access_token: string; expires_in: number }>;
}

/**
 * Get Facebook Pages managed by the user.
 */
export async function getUserPages(userAccessToken: string): Promise<FacebookPageInfo[]> {
  const url = `${GRAPH_API_BASE}/me/accounts?access_token=${userAccessToken}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch user pages: ${res.status}`);
  const data = (await res.json()) as { data: FacebookPageInfo[] };
  return data.data ?? [];
}

/**
 * Publish a post to a Facebook Page.
 */
export async function publishPost(
  pageAccessToken: string,
  pageId: string,
  message: string,
  mediaUrl?: string,
  scheduledTime?: number,
): Promise<FacebookPostResult> {
  const body: Record<string, string> = { message, access_token: pageAccessToken };

  if (scheduledTime) {
    body.scheduled_publish_time = String(scheduledTime);
    body.published = 'false';
  }

  if (mediaUrl) {
    // Photo post
    body.url = mediaUrl;
    const res = await fetch(`${GRAPH_API_BASE}/${pageId}/photos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(body),
    });
    if (!res.ok) throw new Error(`Failed to publish photo post: ${res.status} ${await res.text()}`);
    return res.json() as Promise<FacebookPostResult>;
  }

  // Text post
  body.no_story = 'true';
  const res = await fetch(`${GRAPH_API_BASE}/${pageId}/feed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body),
  });
  if (!res.ok) throw new Error(`Failed to publish post: ${res.status} ${await res.text()}`);
  return res.json() as Promise<FacebookPostResult>;
}

/**
 * Get post engagement metrics with views support.
 */
export async function getPostEngagement(
  pageAccessToken: string,
  facebookPostId: string,
): Promise<FacebookEngagement> {
  const url = `${GRAPH_API_BASE}/${facebookPostId}?fields=likes.summary(true),comments.summary(true),shares,insights.metric(post_impressions,post_impressions_unique)&access_token=${pageAccessToken}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch post engagement: ${res.status}`);
  const data = (await res.json()) as {
    likes?: { summary?: { total_count: number } };
    comments?: { summary?: { total_count: number } };
    shares?: { count: number };
    insights?: { data: Array<{ name: string; values: Array<{ value: number }> }> };
  };

  let views = 0;
  if (data.insights?.data) {
    const impressions = data.insights.data.find((i) => i.name === 'post_impressions');
    if (impressions?.values?.[0]) views = impressions.values[0].value;
  }

  return {
    likes: data.likes?.summary?.total_count ?? 0,
    comments: data.comments?.summary?.total_count ?? 0,
    shares: data.shares?.count ?? 0,
    views,
  };
}

/**
 * Batch fetch engagement for multiple posts using Facebook's Batch API.
 * This collapses N subrequests into 1, staying well under Cloudflare's limit.
 * Max 50 operations per batch per Facebook's spec.
 */
export async function batchGetPostEngagements(
  pageAccessToken: string,
  facebookPostIds: string[],
): Promise<Map<string, FacebookEngagement>> {
  const results = new Map<string, FacebookEngagement>();

  if (facebookPostIds.length === 0) return results;

  // Build batch operations — max 50 per batch
  const batchSize = 50;
  for (let i = 0; i < facebookPostIds.length; i += batchSize) {
    const chunk = facebookPostIds.slice(i, i + batchSize);
    const batch = chunk.map((postId) => ({
      method: 'GET' as const,
      relative_url: `${postId}?fields=likes.summary(true),comments.summary(true),shares,insights.metric(post_impressions)`,
    }));

    const url = `${GRAPH_API_BASE}/?access_token=${pageAccessToken}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ batch }),
    });

    if (!res.ok) {
      console.error(`Batch engagement fetch failed: ${res.status}`);
      continue; // Skip this batch, return partial results
    }

    const data = (await res.json()) as Array<{
      code: number;
      body: string;
    }>;

    for (let j = 0; j < data.length; j++) {
      const item = data[j];
      const postId = chunk[j];
      if (!item || !postId) continue;

      if (item.code !== 200) {
        results.set(postId, { likes: 0, comments: 0, shares: 0, views: 0 });
        continue;
      }

      try {
        const body = JSON.parse(item.body) as {
          likes?: { summary?: { total_count: number } };
          comments?: { summary?: { total_count: number } };
          shares?: { count: number };
          insights?: { data: Array<{ name: string; values: Array<{ value: number }> }> };
        };

        let views = 0;
        if (body.insights?.data) {
          const imp = body.insights.data.find((x) => x.name === 'post_impressions');
          if (imp?.values?.[0]) views = imp.values[0].value;
        }

        results.set(postId, {
          likes: body.likes?.summary?.total_count ?? 0,
          comments: body.comments?.summary?.total_count ?? 0,
          shares: body.shares?.count ?? 0,
          views,
        });
      } catch {
        results.set(postId, { likes: 0, comments: 0, shares: 0, views: 0 });
      }
    }
  }

  return results;
}

/**
 * Fetch posts from a Facebook page timeline.
 */
export async function getPagePosts(
  pageAccessToken: string,
  pageId: string,
  limit = 100,
): Promise<FacebookPostInfo[]> {
  const url = `${GRAPH_API_BASE}/${pageId}/posts?fields=id,message,created_time,permalink_url&limit=${limit}&access_token=${pageAccessToken}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch page posts: ${res.status}`);
  const data = (await res.json()) as { data: FacebookPostInfo[] };
  return data.data ?? [];
}

/**
 * Fetch comments for a Facebook post.
 */
export async function getPostComments(
  pageAccessToken: string,
  facebookPostId: string,
  limit = 100,
): Promise<FacebookComment[]> {
  const url = `${GRAPH_API_BASE}/${facebookPostId}/comments?fields=from,message,like_count,created_time,comments{from,message,like_count,created_time}&limit=${limit}&access_token=${pageAccessToken}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch post comments: ${res.status}`);
  const data = (await res.json()) as { data: FacebookComment[] };
  return data.data ?? [];
}

/**
 * Build a human-friendly Facebook post permalink.
 */
export function buildPermalink(pageUsername: string, facebookPostId: string): string {
  const postId = facebookPostId.split('_').pop() ?? facebookPostId;
  return `https://www.facebook.com/${pageUsername}/posts/${postId}`;
}

/**
 * Clear Facebook share cache for a URL.
 */
export async function clearFacebookCache(accessToken: string, url: string): Promise<boolean> {
  const res = await fetch(`${GRAPH_API_BASE}/?id=${encodeURIComponent(url)}&scrape=true&access_token=${accessToken}`, {
    method: 'POST',
  });
  return res.ok;
}
