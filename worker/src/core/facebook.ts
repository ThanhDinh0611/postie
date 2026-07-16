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
 * Get post engagement metrics.
 */
export async function getPostInsights(
  pageAccessToken: string,
  facebookPostId: string,
): Promise<{ likes: number; comments: number; shares: number; views: number }> {
  const url = `${GRAPH_API_BASE}/${facebookPostId}?fields=likes.summary(true),comments.summary(true),shares&access_token=${pageAccessToken}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch post insights: ${res.status}`);
  const data = (await res.json()) as {
    likes?: { summary?: { total_count: number } };
    comments?: { summary?: { total_count: number } };
    shares?: { count: number };
  };
  return {
    likes: data.likes?.summary?.total_count ?? 0,
    comments: data.comments?.summary?.total_count ?? 0,
    shares: data.shares?.count ?? 0,
    views: 0, // requires `insights` edge
  };
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
