import { z } from 'zod';

export const updateProfileSchema = z
  .object({
    displayName: z.string().trim().min(1).max(80).optional(),
    phone: z.string().regex(/^\+?[0-9 \-]{7,20}$/).nullable().optional(),
    avatarUrl: z.string().url().nullable().optional(),
  })
  .strict();

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
