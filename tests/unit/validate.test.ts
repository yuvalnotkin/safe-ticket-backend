import { describe, it, expect } from 'vitest';
import express from 'express';
import request from 'supertest';
import { z } from 'zod';
import { validateQuery } from '../../src/middleware/validate';

const buildApp = () => {
  const app = express();
  const schema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    sort: z.enum(['a', 'b']).default('a'),
  });
  app.get('/x', validateQuery(schema), (_req, res) => {
    res.json(res.locals.query);
  });
  app.use((err: any, _req: any, res: any, _next: any) => {
    if (err && err.issues) {
      res
        .status(400)
        .json({ error: { code: 'invalid_request', details: err.issues } });
      return;
    }
    res.status(500).json({ error: { code: 'server_error' } });
  });
  return app;
};

describe('validateQuery middleware', () => {
  it('GET /x (no query) → 200 with defaults applied from res.locals.query', async () => {
    const app = buildApp();
    const res = await request(app).get('/x');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ page: 1, sort: 'a' });
  });

  it('GET /x?page=5&sort=b → 200 with coerced and parsed values', async () => {
    const app = buildApp();
    const res = await request(app).get('/x?page=5&sort=b');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ page: 5, sort: 'b' });
  });

  it('GET /x?page=0 → 400 with invalid_request and details array', async () => {
    const app = buildApp();
    const res = await request(app).get('/x?page=0');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('invalid_request');
    expect(Array.isArray(res.body.error.details)).toBe(true);
  });

  it('GET /x?sort=c → 400', async () => {
    const app = buildApp();
    const res = await request(app).get('/x?sort=c');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('invalid_request');
  });
});
