import { Router } from 'express';
import { randomBytes } from 'crypto';
import { env } from '../../utils/env';
import { mockAuthorizeQuerySchema } from './schemas';

const router = Router();

// Mock-only Phase-3 scaffolding. The browser lands here after start-auth and
// is immediately bounced to the frontend's /sell/callback with a fake
// `code`. This route does not validate state (the callback does); it only
// echoes state back so the frontend's CSRF check still has the right value.
router.get('/mock-provider/authorize', (req, res, next) => {
  const parsed = mockAuthorizeQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    next(parsed.error);
    return;
  }
  const { state, provider } = parsed.data;
  const code = `mock-${randomBytes(8).toString('hex')}`;
  const redirect = new URL('/sell/callback', env.FRONTEND_URL);
  redirect.searchParams.set('provider', provider);
  redirect.searchParams.set('code', code);
  redirect.searchParams.set('state', state);
  res.redirect(302, redirect.toString());
});

export default router;
