import { Router } from 'express';
import { z } from 'zod';
import { validateQuery } from '../middleware/validate';
import { listingsSearchSchema, ListingsSearchInput } from './listings.schema';
import * as listingsService from '../services/listings';

const router = Router();

const idParamsSchema = z.object({ id: z.string().uuid() });

router.get(
  '/',
  validateQuery(listingsSearchSchema),
  async (_req, res, next) => {
    try {
      const input = res.locals.query as ListingsSearchInput;
      const result = await listingsService.searchListings(input);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  },
);

router.get('/:id', async (req, res, next) => {
  const parsed = idParamsSchema.safeParse(req.params);
  if (!parsed.success) {
    next(parsed.error);
    return;
  }
  try {
    const listing = await listingsService.getListingById(parsed.data.id);
    res.status(200).json(listing);
  } catch (err) {
    next(err);
  }
});

export default router;
