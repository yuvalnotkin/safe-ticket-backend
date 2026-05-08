import { Router } from 'express';
import { validateQuery } from '../middleware/validate';
import { listingsSearchSchema, ListingsSearchInput } from './listings.schema';
import * as listingsService from '../services/listings';

const router = Router();

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

export default router;
