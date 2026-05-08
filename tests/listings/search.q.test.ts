import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../helpers';

describe('GET /api/listings — free-text q filter', () => {
  it('?q=Hapoel matches the EV-101 event listings only', async () => {
    const res = await request(app).get('/api/listings').query({ q: 'Hapoel', limit: 100 });
    expect(res.status).toBe(200);
    expect(res.body.items.length).toBeGreaterThan(0);
    for (const item of res.body.items) {
      expect(item.event.name).toMatch(/Hapoel/i);
    }
    // Seed has exactly 3 active listings on EV-101.
    expect(res.body.total).toBe(3);
  });

  it('?q=Bloomfield matches by venue', async () => {
    const res = await request(app).get('/api/listings').query({ q: 'Bloomfield', limit: 100 });
    expect(res.status).toBe(200);
    expect(res.body.items.length).toBeGreaterThan(0);
    for (const item of res.body.items) {
      expect(item.event.venue).toBe('Bloomfield Stadium');
    }
  });

  it('?q=tel aviv matches by city, case-insensitive', async () => {
    const res = await request(app).get('/api/listings').query({ q: 'tel aviv', limit: 100 });
    expect(res.status).toBe(200);
    expect(res.body.items.length).toBeGreaterThan(0);
    for (const item of res.body.items) {
      // case-insensitive match against title OR venue OR city
      const haystack = `${item.event.name} ${item.event.venue} ${item.event.city}`.toLowerCase();
      expect(haystack).toContain('tel aviv');
    }
  });

  it('?q= (empty after trim) is rejected by the schema → 400', async () => {
    const res = await request(app).get('/api/listings').query({ q: '   ' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('invalid_request');
  });

  it('?q=,(unsafe)" does not 500 — sanitizer strips dangerous chars, returns sane envelope', async () => {
    const res = await request(app).get('/api/listings').query({ q: ',(unsafe)"' });
    expect(res.status).toBe(200);
    // After stripping , ( ) " — the term becomes "unsafe", which is unlikely to match seed.
    expect(Array.isArray(res.body.items)).toBe(true);
    expect(typeof res.body.total).toBe('number');
  });

  it('?q=ZZZNonExistentZZZ returns empty envelope', async () => {
    const res = await request(app).get('/api/listings').query({ q: 'ZZZNonExistentZZZ' });
    expect(res.status).toBe(200);
    expect(res.body.items).toEqual([]);
    expect(res.body.total).toBe(0);
  });
});
