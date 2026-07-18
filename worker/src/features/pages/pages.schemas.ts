import { z } from 'zod';

export const connectPagesSchema = z.object({
  code: z.string().min(1, 'code is required'),
  redirectUri: z.string().url('redirectUri must be a valid URL'),
});

export type ConnectPagesInput = z.infer<typeof connectPagesSchema>;
