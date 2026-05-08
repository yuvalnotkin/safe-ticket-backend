import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../helpers';

describe('GET /api/listings (basic search)', () => {
  it('returns 200 with envelope shape', async () => {
    const res = await request(app).get('/api/listings');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('items');
    expect(Array.isArray(res.body.items)).toBe(true);
    expect(res.body).toHaveProperty('page', 1);
    expect(res.body).toHaveProperty('limit', 20);
    expect(typeof res.body.total).toBe('number');
    expect(res.body.total).toBeGreaterThanOrEqual(20);
  });

  it('every item conforms to the ListingResponse contract shape', async () => {
    const res = await request(app).get('/api/listings');
    expect(res.status).toBe(200);
    expect(res.body.items.length).toBeGreaterThan(0);
    for (const item of res.body.items) {
      // top-level
      expect(typeof item.id).toBe('string');
      expect(item.status).toBe('active');
      expect(typeof item.provider).toBe('string');
      expect(typeof item.createdAt).toBe('string');
      // event
      expect(typeof item.event.name).toBe('string');
      expect(typeof item.event.date).toBe('string');
      expect(typeof item.event.venue).toBe('string');
      expect(typeof item.event.city).toBe('string');
      expect(['sports', 'culture']).toContain(item.event.category);
      // seat — GA tickets have null row/seat; we only verify the keys exist
      expect(item.seat).toHaveProperty('section');
      expect(item.seat).toHaveProperty('row');
      expect(item.seat).toHaveProperty('seat');
      // price (integer agorot)
      expect(Number.isInteger(item.price.faceValueAgorot)).toBe(true);
      expect(Number.isInteger(item.price.serviceFeeAgorot)).toBe(true);
      expect(item.price.faceValueAgorot).toBeGreaterThanOrEqual(0);
      // floor 10% — fee is exactly Math.floor(face/10)
      expect(item.price.serviceFeeAgorot).toBe(Math.floor(item.price.faceValueAgorot / 10));
      // no DB-internal columns leaked
      expect(item).not.toHaveProperty('row_label');
      expect(item).not.toHaveProperty('event_id');
      expect(item).not.toHaveProperty('total_price_agorot');
      expect(item).not.toHaveProperty('listing_published_at');
    }
  });

  it('default sort is soonest (non-decreasing event.date)', async () => {
    const res = await request(app).get('/api/listings').query({ limit: 100 });
    expect(res.status).toBe(200);
    const dates = res.body.items.map((i: any) => i.event.date);
    for (let k = 1; k < dates.length; k++) {
      expect(dates[k] >= dates[k - 1]).toBe(true);
    }
  });

  it('returns only active listings (no draft/sold/expired/etc.)', async () => {
    const res = await request(app).get('/api/listings').query({ limit: 100 });
    expect(res.status).toBe(200);
    for (const item of res.body.items) {
      expect(item.status).toBe('active');
    }
  });
});
