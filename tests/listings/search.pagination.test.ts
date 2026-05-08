import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../helpers';

describe('GET /api/listings — pagination', () => {
  it('?limit=5&page=1 returns 5 items', async () => {
    const res = await request(app).get('/api/listings').query({ limit: '5', page: '1' });
    expect(res.status).toBe(200);
    expect(res.body.items.length).toBe(5);
    expect(res.body.page).toBe(1);
    expect(res.body.limit).toBe(5);
  });

  it('?limit=5&page=2 disjoint from page=1; same sort order; concat == limit=10&page=1', async () => {
    const [p1, p2, both] = await Promise.all([
      request(app).get('/api/listings').query({ limit: '5', page: '1' }),
      request(app).get('/api/listings').query({ limit: '5', page: '2' }),
      request(app).get('/api/listings').query({ limit: '10', page: '1' }),
    ]);
    const idsP1 = new Set(p1.body.items.map((i: any) => i.id));
    const idsP2 = p2.body.items.map((i: any) => i.id);
    for (const id of idsP2) {
      expect(idsP1.has(id)).toBe(false);
    }
    const concatIds = [...p1.body.items, ...p2.body.items].map((i: any) => i.id);
    const bothIds = both.body.items.map((i: any) => i.id);
    expect(concatIds).toEqual(bothIds);
  });

  it('?limit=200 returns 400 (over max)', async () => {
    const res = await request(app).get('/api/listings').query({ limit: '200' });
    expect(res.status).toBe(400);
  });

  it('?page=0 returns 400 (under min)', async () => {
    const res = await request(app).get('/api/listings').query({ page: '0' });
    expect(res.status).toBe(400);
  });

  it('?page=99999 returns 200 with empty items, but total matches a page=1 request', async () => {
    const [far, near] = await Promise.all([
      request(app).get('/api/listings').query({ page: '99999' }),
      request(app).get('/api/listings').query({ page: '1' }),
    ]);
    expect(far.status).toBe(200);
    expect(far.body.items).toEqual([]);
    expect(far.body.total).toBe(near.body.total);
  });
});
