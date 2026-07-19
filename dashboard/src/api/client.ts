import type {
  PageData,
  PostData,
  CampaignData,
  PageAnalysisData,
  GenerateRequest,
  GenerateResponse,
  PublishRequest,
  PublishResponse,
  UploadResponse,
  SyncResponse,
  SyncStatusResponse,
  PostEngagementResponse,
  CommentsResponse,
} from './types.ts';

const API_BASE = import.meta.env.VITE_API_URL ?? '';

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
  params?: { status?: string; pageId?: string; campaignId?: string; sortBy?: string; offset?: number; limit?: number }
): Promise<PostData[]> {
  const searchParams = new URLSearchParams();
  if (params?.status) searchParams.set('status', params.status);
  if (params?.pageId) searchParams.set('pageId', params.pageId);
  if (params?.campaignId) searchParams.set('campaignId', params.campaignId);
  if (params?.sortBy) searchParams.set('sortBy', params.sortBy);
  if (params?.offset) searchParams.set('offset', String(params.offset));
  if (params?.limit) searchParams.set('limit', String(params.limit));
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

export async function syncAllPosts(token: string, pageId?: string): Promise<SyncResponse> {
  const body = pageId ? JSON.stringify({ pageId }) : undefined;
  return fetchJson<SyncResponse>(`${API_BASE}/api/sync/posts`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(token)
    },
    body
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
  params: { useClipy: boolean; targetUrl?: string; linkTitle?: string; linkDescription?: string; imageUrl?: string },
  token: string
): Promise<{ comment: string }> {
  return fetchJson<{ comment: string }>(`${API_BASE}/api/posts/${postId}/comments/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
    body: JSON.stringify(params),
  });
}

export async function deletePost(postId: string, token: string): Promise<{ success: boolean }> {
  return fetchJson<{ success: boolean }>(`${API_BASE}/api/posts/${postId}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  });
}

export async function deletePostComment(postId: string, commentId: string, token: string): Promise<{ success: boolean }> {
  return fetchJson<{ success: boolean }>(`${API_BASE}/api/posts/${postId}/comments/${commentId}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  });
}
