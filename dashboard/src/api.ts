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
}

export interface GenerateRequest {
  topic: string;
  hookType: string;
  formula: string;
  tone: string;
  postFormat?: 'Post' | 'Reel' | 'Video';
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
}

export interface PublishResponse {
  postId: string;
  facebookPostId: string;
  permalink: string;
  status: string;
}

export interface LinkData {
  id: string;
  permalink: string;
  facebook_post_id: string;
  message: string;
  status: string;
  published_at: number | null;
  created_at: number;
  page_name: string;
  page_username: string;
}

export interface UploadResponse {
  image_url: string;
  fileName: string;
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

export async function getPosts(token: string, params?: { status?: string; pageId?: string }): Promise<PostData[]> {
  const searchParams = new URLSearchParams();
  if (params?.status) searchParams.set('status', params.status);
  if (params?.pageId) searchParams.set('pageId', params.pageId);
  const qs = searchParams.toString();
  return fetchJson<PostData[]>(`${API_BASE}/api/posts${qs ? `?${qs}` : ''}`, { headers: authHeaders(token) });
}

export async function clearPostCache(postId: string, token: string): Promise<{ success: boolean; url: string; results: Record<string, string> }> {
  return fetchJson(`${API_BASE}/api/posts/${postId}/clear-cache`, {
    method: 'POST', headers: authHeaders(token),
  });
}

// ─── Links API ───────────────────────────────────────────────────────────────

export async function getLinks(token: string): Promise<LinkData[]> {
  return fetchJson<LinkData[]>(`${API_BASE}/api/links`, { headers: authHeaders(token) });
}

export async function getLinkDetail(postId: string, token: string): Promise<LinkData> {
  return fetchJson<LinkData>(`${API_BASE}/api/links/${postId}`, { headers: authHeaders(token) });
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
