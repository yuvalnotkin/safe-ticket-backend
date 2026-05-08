import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../helpers';

describe('GET /api/listings — category filter', () => {
  it('?category=sports returns only sport-category items', async () => {
    const res = await request(app).get('/api/listings').query({ category: 'sports', limit: 100 });
    expect(res.status).toBe(200);
    expect(res.body.items.length).toBeGreaterThan(0);
    for (const item of res.body.items) {
      expect(item.event.category).toBe('sports');
    }
  });

  it('?category=culture returns only culture-category items', async () => {
    const res = await request(app).get('/api/listings').query({ category: 'culture', limit: 100 });
    expect(res.status).toBe(200);
    expect(res.body.items.length).toBeGreaterThan(0);
    for (const item of res.body.items) {
      expect(item.event.category).toBe('culture');
    }
  });

  it('sports total + culture total === unfiltered total (active)', async () => {
    const [unf, sports, culture] = await Promise.all([
      request(app).get('/api/listings').query({ limit: 100 }),
      request(app).get('/api/listings').query({ category: 'sports', limit: 100 }),
      request(app).get('/api/listings').query({ category: 'culture', limit: 100 }),
    ]);
    expect(unf.status).toBe(200);
    expect(sports.body.total + culture.body.total).toBe(unf.body.total);
  });
});
