import { z } from 'zod';
import { PROVIDER_SLUGS } from '../../connectors';

export const providerSlugSchema = z.enum(PROVIDER_SLUGS);

export const startAuthBodySchema = z
  .object({
    provider: providerSlugSchema,
  })
  .strict();

export const callbackBodySchema = z
  .object({
    provider: providerSlugSchema,
    code: z.string().min(1),
    state: z.string().min(1),
  })
  .strict();

export const ticketsQuerySchema = z
  .object({
    provider: providerSlugSchema,
  })
  .strict();

export const createListingBodySchema = z
  .object({
    provider: providerSlugSchema,
    providerTicketId: z.string().min(1),
  })
  .strict();

export const mockAuthorizeQuerySchema = z.object({
  state: z.string().min(1),
  provider: providerSlugSchema,
});

export type StartAuthBody = z.infer<typeof startAuthBodySchema>;
export type CallbackBody = z.infer<typeof callbackBodySchema>;
export type TicketsQuery = z.infer<typeof ticketsQuerySchema>;
export type CreateListingBody = z.infer<typeof createListingBodySchema>;
