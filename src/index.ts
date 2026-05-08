import express, { Express } from 'express';
import cors from 'cors';
import { env } from './utils/env';
import authRouter from './routes/auth';
import { errorHandler, notFoundHandler } from './middleware/error';

export function createApp(): Express {
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: '100kb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.use('/api/auth', authRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

if (require.main === module) {
  createApp().listen(env.PORT, () => {
    console.log(`Server running on port ${env.PORT}`);
  });
}
