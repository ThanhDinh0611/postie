import { Hono } from 'hono';
import { getUserIdFromRequest, getUserTier } from '../../core/auth.ts';

export const billingRouter = new Hono<{ Bindings: Env }>();

// Placeholder billing router — extend with VietQR/Casso/SePay as in Clipy

// GET /api/billing/status — Get user's subscription status
billingRouter.get('/billing/status', async (c) => {
  const userId = await getUserIdFromRequest(c.req.raw, c.env);
  if (!userId) return c.json({ error: 'Unauthorized' }, 401);

  const tier = await getUserTier(c.req.raw, c.env, userId);

  const profile = await c.env.DB
    .prepare('SELECT tier, subscription_status, plan_expires_at FROM user_profiles WHERE user_id = ?')
    .bind(userId)
    .first<{ tier: string; subscription_status: string; plan_expires_at: number | null }>();

  const planExpiry = profile?.plan_expires_at ?? null;
  const isExpired = planExpiry ? planExpiry < Math.floor(Date.now() / 1000) : false;

  return c.json({
    tier: profile?.tier ?? tier,
    subscriptionStatus: isExpired ? 'expired' : (profile?.subscription_status ?? 'active'),
    planExpiresAt: planExpiry,
    isExpired,
  });
});
