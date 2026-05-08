import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../helpers';

describe('GET /api/listings — providers filter', () => {
  it('?providers=leaan returns only leaan listings', async () => {
    const res = await request(app).get('/api/listings').query({ providers: 'leaan', limit: 100 });
    expect(res.status).toBe(200);
    expect(res.body.items.length).toBeGreaterThan(0);
    for (const item of res.body.items) {
      expect(item.provider).toBe('leaan');
    }
  });

  it('?providers=leaan,eventim_il returns only leaan or eventim_il listings', async () => {
    const res = await request(app).get('/api/listings').query({ providers: 'leaan,eventim_il', limit: 100 });
    expect(res.status).toBe(200);
    expect(res.body.items.length).toBeGreaterThan(0);
    for (const item of res.body.items) {
      expect(['leaan', 'eventim_il']).toContain(item.provider);
    }
  });

  it('passes seed slugs through unchanged (not contract-example slugs)', async () => {
    // Sanity check: the seed uses `eventim_il` (with underscore), NOT `eventim`. The
    // contract's example list (`ticketmaster|leaan|eventim|hadran`) is non-authoritative.
    // This test pins the actual passthrough behavior so a future "translation layer"
    // would have to update this test deliberately.
    const res = await request(app).get('/api/listings').query({ providers: 'eventim_il', limit: 100 });
    expect(res.status).toBe(200);
    expect(res.body.items.length).toBeGreaterThan(0);
    for (const item of res.body.items) {
      expect(item.provider).toBe('eventim_il');
    }
  });
});
