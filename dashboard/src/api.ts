// ─── Types ───────────────────────────────────────────────────────────────────

export interface PageData {
  id: string;
  facebook_page_id: string;
  name: string;
  username: string | null;
  avatar_url: string | null;
  is_active: number;
}

export interface PostData {
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
  created_at: number;
  published_at: number | null;
  page_name?: string;
  campaign_id?: string | null;
  generation_id?: string | null;
  likes?: number;
  comments_count?: number;
  shares?: number;
  views?: number;
  engagement_fetched_at?: number | null;
  campaign_title?: string;
  campaign_color?: string;
}

export interface CampaignData {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  color: string;
  created_at: number;
}

export interface PageAnalysisData {
  id: string;
  pageId: string;
  analyzedAt: number;
  summary: string;
  writingStyleInstructions: string;
  suggestions: Array<{ title: string; description: string; priority: 'High' | 'Medium' | 'Low' }>;
  contentTypePerformance: {
    reelsEngagementRate?: number;
    videosEngagementRate?: number;
    imagesEngagementRate?: number;
    textOnlyEngagementRate?: number;
    [key: string]: number | undefined;
  };
  chartsData: {
    engagementByFormat: Array<{ format: string; avgEngagementRate: number }>;
    engagementByFormula: Array<{ formula: string; avgEngagementRate: number }>;
    postVolumeByMonth: Array<{ month: string; postCount: number }>;
    engagementByHook: Array<{ hook: string; avgEngagementRate: number }>;
  };
  metricsSummary: {
    topPerformingHook: string;
    topPerformingFormula: string;
    topPerformingFormat: string;
    bestPostingDayAndTime: string;
    avgEngagementRate: number;
    totalReachViews: number;
  };
}

export interface GenerateRequest {
  topic: string;
  hookType: string;
  formula: string;
  tone: string;
  postFormat?: 'Post' | 'Reel' | 'Video';
  publishType?: 'image' | 'link';
  wikiSlug?: string;
  allowWebSearch?: boolean;
}

export interface GenerateResponse {
  content: string;
  selectedHook: string;
  formulaApplied: string;
  variants: string[];
  generationId: string;
  tokenUsage: { input: number; output: number; total: number } | null;
  tone?: string;
  linkTitle?: string;
  linkDescription?: string;
}

export interface PublishRequest {
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
}

export interface PublishResponse {
  postId: string;
  facebookPostId: string;
  permalink: string;
  status: string;
}

export interface UploadResponse {
  image_url: string;
  fileName: string;
}

// ─── Sync & Engagement Types ────────────────────────────────────────────────

export interface SyncEngagement {
  likes: number;
  comments: number;
  shares: number;
  views: number;
}

export interface SyncResultItem {
  postId: string;
  facebookPostId: string | null;
  message: string;
  pageName: string;
  status: string;
  engagement: SyncEngagement | null;
  syncedAt: number;
}

export interface SyncStats {
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

export interface SyncResponse {
  success: boolean;
  duration: string;
  totalFetched: number;
  totalSynced: number;
  pages: number;
  pageNames?: string[];
  subrequestsUsed?: number;
  hasMore?: boolean;
  results: SyncResultItem[];
  stats: SyncStats;
}

export interface SyncStatusResponse {
  totalPosts: number;
  pageCount: number;
  pages: Array<{ id: string; name: string; username: string | null }>;
  engagement: {
    totalLikes: number;
    totalComments: number;
    totalShares: number;
    totalViews: number;
  };
  lastSyncAt: number | null;
}

export interface PostEngagementResponse {
  id: string;
  message: string;
  permalink: string | null;
  page_name: string;
  status: string;
  published_at: number | null;
  facebook_post_id: string | null;
  engagement: {
    likes: number;
    comments_count: number;
    shares: number;
    views: number;
    fetched_at: number;
  } | null;
}

export interface CommentData {
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

export interface CommentsResponse {
  comments: CommentData[];
  replies: CommentData[];
  totalCount: number;
}

// ─── Config ──────────────────────────────────────────────────────────────────

const API_BASE = import.meta.env.VITE_API_URL ?? '';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function authHeaders(token?: string): Record<string, string> {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error ?? `Request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

// ─── Pages API ───────────────────────────────────────────────────────────────

export async function getPages(token: string): Promise<PageData[]> {
  return fetchJson<PageData[]>(`${API_BASE}/api/pages`, { headers: authHeaders(token) });
}

export async function oauthConnectPages(code: string, redirectUri: string, token: string): Promise<{ pages: PageData[] }> {
  return fetchJson<{ pages: PageData[] }>(`${API_BASE}/api/pages/oauth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
    body: JSON.stringify({ code, redirectUri }),
  });
}

export async function deletePage(pageId: string, token: string): Promise<void> {
  await fetchJson<void>(`${API_BASE}/api/pages/${pageId}`, { method: 'DELETE', headers: authHeaders(token) });
}

export async function selectActivePage(pageId: string, token: string): Promise<void> {
  await fetchJson<void>(`${API_BASE}/api/pages/${pageId}/select`, { method: 'POST', headers: authHeaders(token) });
}

// ─── Posts API ───────────────────────────────────────────────────────────────

export async function generatePost(request: GenerateRequest, token: string): Promise<GenerateResponse> {
  return fetchJson<GenerateResponse>(`${API_BASE}/api/posts/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
    body: JSON.stringify(request),
  });
}

export async function publishPost(request: PublishRequest, token: string): Promise<PublishResponse> {
  return fetchJson<PublishResponse>(`${API_BASE}/api/posts/publish`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
    body: JSON.stringify(request),
  });
}

export async function getPosts(
  token: string,
  params?: { status?: string; pageId?: string; campaignId?: string; sortBy?: string }
): Promise<PostData[]> {
  const searchParams = new URLSearchParams();
  if (params?.status) searchParams.set('status', params.status);
  if (params?.pageId) searchParams.set('pageId', params.pageId);
  if (params?.campaignId) searchParams.set('campaignId', params.campaignId);
  if (params?.sortBy) searchParams.set('sortBy', params.sortBy);
  const qs = searchParams.toString();
  return fetchJson<PostData[]>(`${API_BASE}/api/posts${qs ? `?${qs}` : ''}`, { headers: authHeaders(token) });
}

export async function clearPostCache(postId: string, token: string): Promise<{ success: boolean; url: string; results: Record<string, string> }> {
  return fetchJson(`${API_BASE}/api/posts/${postId}/clear-cache`, {
    method: 'POST', headers: authHeaders(token),
  });
}


// ─── Media API ───────────────────────────────────────────────────────────────

export async function uploadImage(file: File, token: string): Promise<UploadResponse> {
  const form = new FormData();
  form.append('image', file);
  return fetchJson<UploadResponse>(`${API_BASE}/api/media/upload`, {
    method: 'POST', headers: authHeaders(token), body: form,
  });
}

export async function getMedia(token: string): Promise<{ fileName: string; url: string }[]> {
  return fetchJson(`${API_BASE}/api/media`, { headers: authHeaders(token) });
}

// ─── Auth API ────────────────────────────────────────────────────────────────

export async function syncAuthUser(token: string): Promise<{ success: boolean; role: string }> {
  return fetchJson<{ success: boolean; role: string }>(`${API_BASE}/api/auth/sync`, {
    method: 'POST',
    headers: authHeaders(token),
  });
}

// ─── Sync & Engagement API ──────────────────────────────────────────────────

export async function syncAllPosts(token: string): Promise<SyncResponse> {
  return fetchJson<SyncResponse>(`${API_BASE}/api/sync/posts`, {
    method: 'POST',
    headers: authHeaders(token),
  });
}

export async function getSyncStatus(token: string): Promise<SyncStatusResponse> {
  return fetchJson<SyncStatusResponse>(`${API_BASE}/api/sync/status`, {
    headers: authHeaders(token),
  });
}

export async function getPostEngagement(postId: string, token: string): Promise<PostEngagementResponse> {
  return fetchJson<PostEngagementResponse>(`${API_BASE}/api/posts/${postId}/engagement`, {
    headers: authHeaders(token),
  });
}

export async function getPostComments(postId: string, token: string): Promise<CommentsResponse> {
  return fetchJson<CommentsResponse>(`${API_BASE}/api/posts/${postId}/comments`, {
    headers: authHeaders(token),
  });
}

// ─── Campaigns API ────────────────────────────────────────────────────────────

export async function getCampaigns(token: string): Promise<CampaignData[]> {
  return fetchJson<CampaignData[]>(`${API_BASE}/api/campaigns`, { headers: authHeaders(token) });
}

export async function createCampaign(data: { title: string; description?: string; color?: string }, token: string): Promise<CampaignData> {
  return fetchJson<CampaignData>(`${API_BASE}/api/campaigns`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
    body: JSON.stringify(data),
  });
}

export async function updateCampaign(id: string, data: { title?: string; description?: string; color?: string }, token: string): Promise<{ success: boolean; id: string }> {
  return fetchJson<{ success: boolean; id: string }>(`${API_BASE}/api/campaigns/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
    body: JSON.stringify(data),
  });
}

export async function deleteCampaign(id: string, token: string): Promise<{ success: boolean }> {
  return fetchJson<{ success: boolean }>(`${API_BASE}/api/campaigns/${id}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  });
}

// ─── Page Analyses API ─────────────────────────────────────────────────────────

export async function getPageAnalysis(pageId: string, token: string): Promise<PageAnalysisData | null> {
  return fetchJson<PageAnalysisData | null>(`${API_BASE}/api/pages/${pageId}/analysis`, {
    headers: authHeaders(token),
  });
}

export async function analyzePage(pageId: string, token: string): Promise<PageAnalysisData> {
  return fetchJson<PageAnalysisData>(`${API_BASE}/api/pages/${pageId}/analyze`, {
    method: 'POST',
    headers: authHeaders(token),
  });
}

// ─── Comments API ─────────────────────────────────────────────────────────────

export async function createPostComment(postId: string, message: string, token: string, attachmentUrl?: string): Promise<{ success: boolean; facebookCommentId: string }> {
  return fetchJson<{ success: boolean; facebookCommentId: string }>(`${API_BASE}/api/posts/${postId}/comments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
    body: JSON.stringify({ message, attachmentUrl }),
  });
}

export async function generateComment(
  postId: string,
  params: { useClipy: boolean; targetUrl?: string; linkTitle?: string; linkDescription?: string },
  token: string
): Promise<{ comment: string }> {
  return fetchJson<{ comment: string }>(`${API_BASE}/api/posts/${postId}/comments/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
    body: JSON.stringify(params),
  });
}
