import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../helpers';

describe('GET /api/listings — price range filter', () => {
  it('?minPriceAgorot=20000&maxPriceAgorot=25000 returns only listings whose total is in [20000,25000]', async () => {
    const res = await request(app).get('/api/listings').query({
      minPriceAgorot: '20000',
      maxPriceAgorot: '25000',
      limit: 100,
    });
    expect(res.status).toBe(200);
    expect(res.body.items.length).toBeGreaterThan(0);
    for (const item of res.body.items) {
      const total = item.price.faceValueAgorot + item.price.serviceFeeAgorot;
      expect(total).toBeGreaterThanOrEqual(20000);
      expect(total).toBeLessThanOrEqual(25000);
    }
  });

  it('?minPriceAgorot=99999999 returns empty items, total 0', async () => {
    const res = await request(app).get('/api/listings').query({ minPriceAgorot: '99999999' });
    expect(res.status).toBe(200);
    expect(res.body.items).toEqual([]);
    expect(res.body.total).toBe(0);
  });

  it('?minPriceAgorot=50&maxPriceAgorot=10 returns 400 (cross-field refine)', async () => {
    const res = await request(app).get('/api/listings').query({
      minPriceAgorot: '50',
      maxPriceAgorot: '10',
    });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('invalid_request');
  });

  it('?maxPriceAgorot=-1 returns 400 (out of range)', async () => {
    const res = await request(app).get('/api/listings').query({
      maxPriceAgorot: '-1',
    });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('invalid_request');
  });
});
