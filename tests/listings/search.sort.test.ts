import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../helpers';

describe('GET /api/listings — sort modes', () => {
  it('?sort=soonest&limit=100 returns non-decreasing event.date', async () => {
    const res = await request(app).get('/api/listings').query({ sort: 'soonest', limit: 100 });
    expect(res.status).toBe(200);
    const dates = res.body.items.map((i: any) => i.event.date);
    for (let k = 1; k < dates.length; k++) {
      expect(dates[k] >= dates[k - 1]).toBe(true);
    }
  });

  it('?sort=lowestPrice&limit=100 returns non-decreasing total price', async () => {
    const res = await request(app).get('/api/listings').query({ sort: 'lowestPrice', limit: 100 });
    expect(res.status).toBe(200);
    const totals = res.body.items.map((i: any) => i.price.faceValueAgorot + i.price.serviceFeeAgorot);
    for (let k = 1; k < totals.length; k++) {
      expect(totals[k]).toBeGreaterThanOrEqual(totals[k - 1]);
    }
  });

  it('?sort=newest&limit=100 returns non-increasing createdAt', async () => {
    const res = await request(app).get('/api/listings').query({ sort: 'newest', limit: 100 });
    expect(res.status).toBe(200);
    const created = res.body.items.map((i: any) => i.createdAt);
    for (let k = 1; k < created.length; k++) {
      expect(created[k] <= created[k - 1]).toBe(true);
    }
  });

  it('?sort=oldest returns 400 (invalid enum)', async () => {
    const res = await request(app).get('/api/listings').query({ sort: 'oldest' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('invalid_request');
  });
});
