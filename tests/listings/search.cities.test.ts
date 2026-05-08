import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../helpers';

describe('GET /api/listings — cities filter', () => {
  it('?cities=Tel Aviv returns only Tel Aviv listings', async () => {
    const res = await request(app).get('/api/listings').query({ cities: 'Tel Aviv', limit: 100 });
    expect(res.status).toBe(200);
    expect(res.body.items.length).toBeGreaterThan(0);
    for (const item of res.body.items) {
      expect(item.event.city).toBe('Tel Aviv');
    }
  });

  it('?cities=Tel Aviv,Haifa returns only Tel Aviv or Haifa listings', async () => {
    const res = await request(app).get('/api/listings').query({ cities: 'Tel Aviv,Haifa', limit: 100 });
    expect(res.status).toBe(200);
    expect(res.body.items.length).toBeGreaterThan(0);
    for (const item of res.body.items) {
      expect(['Tel Aviv', 'Haifa']).toContain(item.event.city);
    }
  });

  it('?cities=Nowhere returns empty items but valid envelope', async () => {
    const res = await request(app).get('/api/listings').query({ cities: 'Nowhere' });
    expect(res.status).toBe(200);
    expect(res.body.items).toEqual([]);
    expect(res.body.total).toBe(0);
  });
});
