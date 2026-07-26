import { getTierCapabilities, type TierCapabilities } from './tiers.ts';

export interface ClerkJWTPayload {
  sub: string;
  exp: number;
  iat: number;
  role?: string;
  tier?: string;
  publicMetadata?: {
    tier?: string;
    plan_expires_at?: number;
    role?: string;
  };
}

function base64UrlDecode(str: string): string {
  const s = str.replace(/-/g, '+').replace(/_/g, '/');
  const pad = '='.repeat((4 - (s.length % 4)) % 4);
  return atob(s + pad);
}

export async function verifyClerkJWT(token: string, jwksUrl: string): Promise<ClerkJWTPayload | null> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [headerB64, payloadB64, sigB64] = parts as [string, string, string];

    const header = JSON.parse(base64UrlDecode(headerB64)) as { kid: string; alg: string };
    const payload = JSON.parse(base64UrlDecode(payloadB64)) as ClerkJWTPayload;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;

    const jwksRes = await fetch(jwksUrl);
    if (!jwksRes.ok) return null;

    const jwks = (await jwksRes.json()) as { keys: JsonWebKey[] };
    const jwk = jwks.keys.find((k) => (k as { kid?: string }).kid === header.kid);
    if (!jwk) return null;

    const cryptoKey = await crypto.subtle.importKey(
      'jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify'],
    );
    const data = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
    const sigBytes = Uint8Array.from(base64UrlDecode(sigB64), (c) => c.charCodeAt(0));
    const valid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', cryptoKey, sigBytes, data);
    return valid ? payload : null;
  } catch {
    return null;
  }
}

export async function getUserIdFromRequest(request: Request, env: { CLERK_JWKS_URL: string }): Promise<string | null> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const payload = await verifyClerkJWT(authHeader.slice(7).trim(), env.CLERK_JWKS_URL);
  return payload?.sub ?? null;
}

export async function isAdminRequest(request: Request, env: { DB: D1Database; CLERK_JWKS_URL: string }): Promise<boolean> {
  const userId = await getUserIdFromRequest(request, env);
  if (!userId) return false;

  try {
    const row = await env.DB
      .prepare('SELECT role FROM user_profiles WHERE user_id = ?')
      .bind(userId)
      .first<{ role: string }>();
    return row?.role === 'admin';
  } catch (err) {
    console.error('Failed to verify admin request:', err);
    return false;
  }
}

export async function getUserTier(
  request: Request, env: { DB: D1Database; CLERK_JWKS_URL: string }, userId: string,
): Promise<string> {
  const authHeader = request.headers.get('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const payload = await verifyClerkJWT(authHeader.slice(7), env.CLERK_JWKS_URL);
    if (payload?.publicMetadata?.tier) return payload.publicMetadata.tier;
  }
  try {
    const row = await env.DB
      .prepare('SELECT tier FROM user_profiles WHERE user_id = ?').bind(userId).first<{ tier: string }>();
    if (row) return row.tier;
  } catch { /* table may not exist */ }
  return 'free';
}

export async function authorizeFeature(
  userId: string, feature: keyof TierCapabilities,
  env: { DB: D1Database; CLERK_JWKS_URL: string }, request: Request,
): Promise<{ authorized: boolean; reason?: string }> {
  const tier = await getUserTier(request, env, userId);
  const caps = getTierCapabilities(tier);
  const limit = caps[feature];

  if (typeof limit === 'boolean') {
    return limit
      ? { authorized: true }
      : { authorized: false, reason: `Không khả dụng trên gói '${tier}'. Nâng cấp để sử dụng.` };
  }
  if (typeof limit === 'number') {
    if (limit === Infinity) return { authorized: true };

    if (feature === 'maxPostsPerMonth') {
      const startOfMonth = Math.floor(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1) / 1000);
      const row = await env.DB
        .prepare('SELECT COUNT(*) as count FROM posts WHERE user_id = ? AND created_at >= ?')
        .bind(userId, startOfMonth).first<{ count: number }>();
      if ((row?.count ?? 0) >= limit) {
        return { authorized: false, reason: `Giới hạn ${row?.count ?? 0}/${limit} bài/tháng. Nâng cấp để đăng thêm.` };
      }
    }
    if (feature === 'maxGenerationsPerDay') {
      const startOfDay = Math.floor(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate()) / 1000);
      const row = await env.DB
        .prepare('SELECT COUNT(*) as count FROM generations WHERE user_id = ? AND created_at >= ?')
        .bind(userId, startOfDay).first<{ count: number }>();
      if ((row?.count ?? 0) >= limit) {
        return { authorized: false, reason: `Giới hạn ${row?.count ?? 0}/${limit} lần/ngày. Nâng cấp để tạo thêm.` };
      }
    }
  }
  return { authorized: true };
}
