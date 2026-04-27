import { Request, Response, NextFunction } from 'express';
import { supabaseAdmin } from '../utils/supabase';
import { AppError } from './error';

export interface AuthedUser {
  id: string;
  email: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthedUser;
      accessToken?: string;
    }
  }
}

const extractBearerToken = (req: Request): string | null => {
  const header = req.headers.authorization;
  if (!header || !header.toLowerCase().startsWith('bearer ')) return null;
  return header.slice(7).trim() || null;
};

export const requireAuth = async (
  req: Request,
  _res: Response,
  next: NextFunction,
) => {
  const token = extractBearerToken(req);
  if (!token) {
    next(new AppError(401, 'unauthorized', 'Missing or malformed Authorization header'));
    return;
  }

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) {
    next(new AppError(401, 'unauthorized', 'Invalid or expired token'));
    return;
  }

  req.user = { id: data.user.id, email: data.user.email ?? '' };
  req.accessToken = token;
  next();
};
