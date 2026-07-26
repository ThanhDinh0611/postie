import { z } from 'zod';

export const publishPostSchema = z.object({
  content: z.string().min(1, 'content is required'),
  pageId: z.string().optional(),
  mediaUrl: z.string().url('mediaUrl must be a valid URL').or(z.literal('')).nullable().optional(),
  scheduledAt: z.number().int().positive().nullable().optional(),
  hookType: z.string().optional(),
  formula: z.string().optional(),
  tone: z.string().optional(),
  postFormat: z.string().optional(),
  campaignId: z.string().optional(),
  generationId: z.string().optional(),
  publishType: z.enum(['image', 'link']).optional(),
  targetUrl: z.string().url('targetUrl must be a valid URL').or(z.literal('')).optional(),
  linkTitle: z.string().max(100).optional(),
  linkDescription: z.string().max(200).optional(),
});

export const generatePostSchema = z.object({
  topic: z.string().min(1, 'topic is required'),
  hookType: z.string().min(1, 'hookType is required'),
  formula: z.string().min(1, 'formula is required'),
  tone: z.string().min(1, 'tone is required'),
  postFormat: z.enum(['Post', 'Reel', 'Video']).optional(),
  publishType: z.enum(['image', 'link']).optional(),
  wikiSlug: z.string().optional(),
  allowWebSearch: z.boolean().optional(),
  reelDuration: z.number().int().positive().optional(),
});

export const createCommentSchema = z.object({
  message: z.string().min(1, 'message is required'),
  attachmentUrl: z.string().url('attachmentUrl must be a valid URL').or(z.literal('')).nullable().optional(),
});

export const generateCommentSchema = z.object({
  useClipy: z.boolean(),
  targetUrl: z.string().url('targetUrl must be a valid URL').optional(),
  linkTitle: z.string().optional(),
  linkDescription: z.string().optional(),
  imageUrl: z.string().url('imageUrl must be a valid URL').or(z.literal('')).optional(),
});

export type PublishPostInput = z.infer<typeof publishPostSchema>;
export type GeneratePostInput = z.infer<typeof generatePostSchema>;
export type CreateCommentInput = z.infer<typeof createCommentSchema>;
export type GenerateCommentInput = z.infer<typeof generateCommentSchema>;
