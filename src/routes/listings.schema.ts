import { z } from 'zod';

const csv = (max: number) =>
  z
    .string()
    .transform((s) => s.split(',').map((x) => x.trim()).filter(Boolean))
    .pipe(z.array(z.string().min(1).max(80)).min(1).max(max));

const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD');

export const listingsSearchSchema = z
  .object({
    q: z.string().trim().min(1).max(120).optional(),
    category: z.enum(['sports', 'culture']).optional(),
    cities: csv(20).optional(),
    providers: csv(20).optional(),
    dateFrom: ymd.optional(),
    dateTo: ymd.optional(),
    minPriceAgorot: z.coerce.number().int().min(0).max(100_000_000).optional(),
    maxPriceAgorot: z.coerce.number().int().min(0).max(100_000_000).optional(),
    sort: z.enum(['soonest', 'lowestPrice', 'newest']).default('soonest'),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  })
  .refine(
    (v) => !(v.dateFrom && v.dateTo) || v.dateFrom <= v.dateTo,
    { path: ['dateTo'], message: 'dateTo must be on or after dateFrom' },
  )
  .refine(
    (v) =>
      !(v.minPriceAgorot != null && v.maxPriceAgorot != null) ||
      v.minPriceAgorot <= v.maxPriceAgorot,
    {
      path: ['maxPriceAgorot'],
      message: 'maxPriceAgorot must be ≥ minPriceAgorot',
    },
  );

export type ListingsSearchInput = z.infer<typeof listingsSearchSchema>;
