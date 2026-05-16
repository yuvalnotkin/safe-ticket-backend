import { Router } from 'express';
import { requireAuth } from '../../middleware/auth';
import { validateBody } from '../../middleware/validate';
import { AppError } from '../../middleware/error';
import { dispatcher } from '../../connectors';
import { callbackBodySchema, CallbackBody } from './schemas';
import { upsertProviderSession } from '../../services/sell/provider-sessions';

const router = Router();

router.post(
  '/callback',
  requireAuth,
  validateBody(callbackBodySchema),
  async (req, res, next) => {
    try {
      if (!req.user) {
        throw new AppError(401, 'unauthorized', 'No authenticated user');
      }
      const body = req.body as CallbackBody;

      let callback;
      try {
        callback = await dispatcher.handleCallback({
          provider: body.provider,
          code: body.code,
          state: body.state,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'connector rejected callback';
        throw new AppError(400, 'callback_failed', message);
      }

      await upsertProviderSession(req.user.id, body.provider, callback);

      res.status(200).json({
        providerUserId: callback.providerUserId,
        expiresAt: callback.expiresAt,
      });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
