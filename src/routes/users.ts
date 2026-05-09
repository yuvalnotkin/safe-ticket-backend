import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { AppError } from '../middleware/error';
import { updateProfileSchema, UpdateProfileInput } from './users.schema';
import * as profileService from '../services/profile';

const router = Router();

router.get('/me/profile', requireAuth, async (req, res, next) => {
  try {
    if (!req.user) {
      throw new AppError(401, 'unauthorized', 'No authenticated user');
    }
    const profile = await profileService.getProfile(req.user.id);
    res.status(200).json(profile);
  } catch (err) {
    next(err);
  }
});

router.put(
  '/me/profile',
  requireAuth,
  validateBody(updateProfileSchema),
  async (req, res, next) => {
    try {
      if (!req.user) {
        throw new AppError(401, 'unauthorized', 'No authenticated user');
      }
      const input = req.body as UpdateProfileInput;
      const profile = await profileService.updateProfile(req.user.id, input);
      res.status(200).json(profile);
    } catch (err) {
      next(err);
    }
  },
);

export default router;
