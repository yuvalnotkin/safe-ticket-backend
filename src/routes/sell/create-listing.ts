import { Router } from 'express';
import { requireAuth } from '../../middleware/auth';
import { validateBody } from '../../middleware/validate';
import { AppError } from '../../middleware/error';
import { dispatcher } from '../../connectors';
import { createListingBodySchema, CreateListingBody } from './schemas';
import { getActiveProviderSession } from '../../services/sell/provider-sessions';
import { createListingAtomic } from '../../services/sell/create-listing';

const router = Router();

router.post(
  '/create-listing',
  requireAuth,
  validateBody(createListingBodySchema),
  async (req, res, next) => {
    try {
      if (!req.user) {
        throw new AppError(401, 'unauthorized', 'No authenticated user');
      }
      const body = req.body as CreateListingBody;

      const session = await getActiveProviderSession(req.user.id, body.provider);
      if (!session) {
        throw new AppError(
          409,
          'no_provider_session',
          'No active provider session for this user + provider',
        );
      }

      const tickets = await dispatcher.listTickets({
        userId: req.user.id,
        provider: body.provider,
        providerUserId: session.provider_user_id,
      });
      const target = tickets.find(
        t => t.providerTicketId === body.providerTicketId,
      );
      if (!target) {
        throw new AppError(
          409,
          'ticket_not_eligible',
          'Ticket not present in caller inventory',
          { reason: 'ownership_mismatch' },
        );
      }
      if (!target.eligible) {
        if (target.ineligibleReason === 'already_listed_on_safe_ticket') {
          throw new AppError(
            409,
            'already_listed',
            'A non-removed listing already exists for this ticket',
          );
        }
        throw new AppError(
          409,
          'ticket_not_eligible',
          `Ticket is ineligible: ${target.ineligibleReason}`,
          { reason: target.ineligibleReason },
        );
      }

      // Defense-in-depth re-checks against the connector. The listTickets
      // result above already includes provider-side eligibility; re-running
      // verifyOwnership + checkTransferEligibility catches the case where
      // provider state changed between rendering the picker and submission.
      const own = await dispatcher.verifyOwnership({
        provider: body.provider,
        providerUserId: session.provider_user_id,
        providerTicketId: body.providerTicketId,
      });
      if (!own.ok) {
        throw new AppError(
          409,
          'ticket_not_eligible',
          `Ownership check failed: ${own.reason}`,
          { reason: own.reason },
        );
      }
      const elig = await dispatcher.checkTransferEligibility({
        provider: body.provider,
        providerUserId: session.provider_user_id,
        providerTicketId: body.providerTicketId,
      });
      if (!elig.ok) {
        throw new AppError(
          409,
          'ticket_not_eligible',
          `Eligibility check failed: ${elig.reason}`,
          { reason: elig.reason },
        );
      }

      const listing = await createListingAtomic({
        userId: req.user.id,
        provider: body.provider,
        ticket: target,
      });

      res.status(201).json(listing);
    } catch (err) {
      next(err);
    }
  },
);

export default router;
