import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../helpers';

describe('GET /api/listings — sort modes', () => {
  it('?sort=soonest is the default and returns non-decreasing event.date', async () => {
    const [defaultRes, explicitRes] = await Promise.all([
      request(app).get('/api/listings').query({ limit: 100 }),
      request(app).get('/api/listings').query({ sort: 'soonest', limit: 100 }),
    ]);
    expect(defaultRes.status).toBe(200);
    expect(explicitRes.status).toBe(200);
    const ids = (b: any) => b.items.map((i: any) => i.id);
    expect(ids(defaultRes.body)).toEqual(ids(explicitRes.body));
    const dates = explicitRes.body.items.map((i: any) => i.event.date);
    for (let k = 1; k < dates.length; k++) {
      expect(dates[k] >= dates[k - 1]).toBe(true);
    }
  });

  it('?sort=lowestPrice returns non-decreasing total (face + fee)', async () => {
    const res = await request(app).get('/api/listings').query({ sort: 'lowestPrice', limit: 100 });
    expect(res.status).toBe(200);
    expect(res.body.items.length).toBeGreaterThan(0);
    const totals = res.body.items.map(
      (i: any) => i.price.faceValueAgorot + i.price.serviceFeeAgorot,
    );
    for (let k = 1; k < totals.length; k++) {
      expect(totals[k]).toBeGreaterThanOrEqual(totals[k - 1]);
    }
  });

  it('?sort=newest returns non-increasing createdAt', async () => {
    const res = await request(app).get('/api/listings').query({ sort: 'newest', limit: 100 });
    expect(res.status).toBe(200);
    expect(res.body.items.length).toBeGreaterThan(0);
    const dates = res.body.items.map((i: any) => i.createdAt);
    for (let k = 1; k < dates.length; k++) {
      expect(dates[k] <= dates[k - 1]).toBe(true);
    }
  });

  it('?sort=oldest is rejected by the schema → 400', async () => {
    const res = await request(app).get('/api/listings').query({ sort: 'oldest' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('invalid_request');
  });
});
