import { Router } from 'express';
import { requireAuth } from '../../middleware/auth';
import { AppError } from '../../middleware/error';
import { dispatcher } from '../../connectors';
import { ticketsQuerySchema } from './schemas';
import { getActiveProviderSession } from '../../services/sell/provider-sessions';
import { toApiConnectorTicket } from '../../services/sell/connector-ticket';

const router = Router();

router.get('/tickets', requireAuth, async (req, res, next) => {
  try {
    if (!req.user) {
      throw new AppError(401, 'unauthorized', 'No authenticated user');
    }
    const parsed = ticketsQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      next(parsed.error);
      return;
    }
    const { provider } = parsed.data;

    const session = await getActiveProviderSession(req.user.id, provider);
    if (!session) {
      throw new AppError(
        409,
        'no_provider_session',
        'No active provider session for this user + provider',
      );
    }

    const tickets = await dispatcher.listTickets({
      userId: req.user.id,
      provider,
      providerUserId: session.provider_user_id,
    });

    res.status(200).json({ items: tickets.map(toApiConnectorTicket) });
  } catch (err) {
    next(err);
  }
});

export default router;
