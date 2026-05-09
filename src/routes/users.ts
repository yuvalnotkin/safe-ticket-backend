import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { AppError } from '../middleware/error';
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

// PUT handler added in T5.

export default router;
