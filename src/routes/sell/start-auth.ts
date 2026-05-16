import { Router } from 'express';
import { requireAuth } from '../../middleware/auth';
import { validateBody } from '../../middleware/validate';
import { AppError } from '../../middleware/error';
import { dispatcher } from '../../connectors';
import { startAuthBodySchema, StartAuthBody } from './schemas';

const router = Router();

router.post(
  '/start-auth',
  requireAuth,
  validateBody(startAuthBodySchema),
  async (req, res, next) => {
    try {
      if (!req.user) {
        throw new AppError(401, 'unauthorized', 'No authenticated user');
      }
      const body = req.body as StartAuthBody;
      const result = await dispatcher.startAuth({
        provider: body.provider,
        userId: req.user.id,
      });
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  },
);

export default router;
