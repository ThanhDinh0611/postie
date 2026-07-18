import { z } from 'zod';

export const createCampaignSchema = z.object({
  title: z.string().min(1, 'title is required'),
  description: z.string().nullable().optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'color must be a valid hex color code').optional(),
});

export const updateCampaignSchema = z.object({
  title: z.string().min(1, 'title cannot be empty').optional(),
  description: z.string().nullable().optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'color must be a valid hex color code').optional(),
});

export type CreateCampaignInput = z.infer<typeof createCampaignSchema>;
export type UpdateCampaignInput = z.infer<typeof updateCampaignSchema>;
