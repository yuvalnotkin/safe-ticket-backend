import express from 'express';
import cors from 'cors';
import { env } from './utils/env';
import authRouter from './routes/auth';
import { errorHandler, notFoundHandler } from './middleware/error';

const app = express();

app.use(cors());
app.use(express.json({ limit: '100kb' }));

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/auth', authRouter);

app.use(notFoundHandler);
app.use(errorHandler);

app.listen(env.PORT, () => {
  console.log(`Server running on port ${env.PORT}`);
});
