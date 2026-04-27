import { Router } from 'express';
import { z } from 'zod';
import { validateBody } from '../middleware/validate';
import { requireAuth } from '../middleware/auth';
import * as authService from '../services/auth';
import { AppError } from '../middleware/error';

const router = Router();

const signupSchema = z.object({
  email: z.string().email().max(254).toLowerCase(),
  password: z.string().min(8).max(128),
  displayName: z.string().trim().min(1).max(80),
});

const loginSchema = z.object({
  email: z.string().email().max(254).toLowerCase(),
  password: z.string().min(1).max(128),
});

router.post('/signup', validateBody(signupSchema), async (req, res, next) => {
  try {
    const { email, password, displayName } = req.body as z.infer<typeof signupSchema>;
    const result = await authService.signup(email, password, displayName);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

router.post('/login', validateBody(loginSchema), async (req, res, next) => {
  try {
    const { email, password } = req.body as z.infer<typeof loginSchema>;
    const result = await authService.login(email, password);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

router.post('/logout', requireAuth, async (req, res, next) => {
  try {
    if (!req.accessToken) {
      throw new AppError(401, 'unauthorized', 'Missing access token');
    }
    await authService.logout(req.accessToken);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

router.get('/me', requireAuth, async (req, res, next) => {
  try {
    if (!req.user) {
      throw new AppError(401, 'unauthorized', 'No authenticated user');
    }
    const me = await authService.getMe(req.user.id);
    res.status(200).json(me);
  } catch (err) {
    next(err);
  }
});

export default router;
