import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { getUserIdFromRequest } from '../../core/auth.ts';
import { CampaignRepository } from '../../db/CampaignRepository.ts';
import { createCampaignSchema, updateCampaignSchema } from './campaigns.schemas.ts';

export const campaignsRouter = new Hono<{ Bindings: Env }>();

// GET /api/campaigns — List campaigns
campaignsRouter.get('/campaigns', async (c) => {
  const userId = await getUserIdFromRequest(c.req.raw, c.env);
  if (!userId) return c.json({ error: 'Unauthorized' }, 401);

  try {
    const campaigns = await CampaignRepository.getCampaignsByUser(c.env.DB, userId);
    return c.json(campaigns);
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : 'Failed to fetch campaigns' }, 500);
  }
});

// POST /api/campaigns — Create a campaign
campaignsRouter.post('/campaigns', zValidator('json', createCampaignSchema), async (c) => {
  const userId = await getUserIdFromRequest(c.req.raw, c.env);
  if (!userId) return c.json({ error: 'Unauthorized' }, 401);

  const body = c.req.valid('json');
  const id = crypto.randomUUID();
  const color = body.color ?? '#3b82f6';
  const description = body.description ?? null;

  try {
    await CampaignRepository.createCampaign(c.env.DB, id, userId, body.title, description, color);
    return c.json({ id, title: body.title, description, color });
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : 'Failed to create campaign' }, 500);
  }
});

// PUT /api/campaigns/:id — Update a campaign
campaignsRouter.put('/campaigns/:id', zValidator('json', updateCampaignSchema), async (c) => {
  const userId = await getUserIdFromRequest(c.req.raw, c.env);
  if (!userId) return c.json({ error: 'Unauthorized' }, 401);

  const id = c.req.param('id');
  const body = c.req.valid('json');

  try {
    const existing = await CampaignRepository.findCampaignByIdAndUser(c.env.DB, id, userId);
    if (!existing) {
      return c.json({ error: 'Campaign not found' }, 404);
    }

    const updated = await CampaignRepository.updateCampaign(c.env.DB, id, userId, body);
    if (!updated && Object.keys(body).length > 0) {
      return c.json({ error: 'Failed to update campaign' }, 500);
    }

    return c.json({ success: true, id });
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : 'Failed to update campaign' }, 500);
  }
});

// DELETE /api/campaigns/:id — Delete a campaign
campaignsRouter.delete('/campaigns/:id', async (c) => {
  const userId = await getUserIdFromRequest(c.req.raw, c.env);
  if (!userId) return c.json({ error: 'Unauthorized' }, 401);

  const id = c.req.param('id');

  try {
    const existing = await CampaignRepository.findCampaignByIdAndUser(c.env.DB, id, userId);
    if (!existing) {
      return c.json({ error: 'Campaign not found' }, 404);
    }

    await CampaignRepository.deleteCampaign(c.env.DB, id, userId);
    return c.json({ success: true });
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : 'Failed to delete campaign' }, 500);
  }
});
