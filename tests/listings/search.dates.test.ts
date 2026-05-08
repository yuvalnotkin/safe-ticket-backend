import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../helpers';

describe('GET /api/listings — date range filter', () => {
  // Seed event EV-101 'Maccabi TA vs Hapoel TA' is at 2026-05-09 18:30 UTC,
  // which is 2026-05-09 21:30 Asia/Jerusalem (IDT). Three active listings.

  it('?dateFrom=2026-05-09&dateTo=2026-05-09 includes the IDT-local-day-9 event', async () => {
    const res = await request(app).get('/api/listings').query({
      dateFrom: '2026-05-09',
      dateTo: '2026-05-09',
      limit: 100,
    });
    expect(res.status).toBe(200);
    expect(res.body.items.length).toBeGreaterThan(0);
    const titles = res.body.items.map((i: any) => i.event.name);
    expect(titles).toContain('Maccabi TA vs Hapoel TA');
    // every returned event happens on May 9 IDT (event date when shown in IL time falls on 2026-05-09)
    for (const item of res.body.items) {
      const utc = new Date(item.event.date);
      // Convert to IL local date string (date part only)
      const il = utc.toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' });
      expect(il).toBe('2026-05-09');
    }
  });

  it('?dateFrom=2026-05-10 excludes the IDT-day-9 event', async () => {
    const res = await request(app).get('/api/listings').query({
      dateFrom: '2026-05-10',
      limit: 100,
    });
    expect(res.status).toBe(200);
    const titles = res.body.items.map((i: any) => i.event.name);
    expect(titles).not.toContain('Maccabi TA vs Hapoel TA');
  });

  it('?dateTo=2026-05-08 excludes the IDT-day-9 event', async () => {
    const res = await request(app).get('/api/listings').query({
      dateTo: '2026-05-08',
      limit: 100,
    });
    expect(res.status).toBe(200);
    const titles = res.body.items.map((i: any) => i.event.name);
    expect(titles).not.toContain('Maccabi TA vs Hapoel TA');
  });

  it('?dateFrom=2026-08-01&dateTo=2026-07-01 returns 400 (cross-field refine)', async () => {
    const res = await request(app).get('/api/listings').query({
      dateFrom: '2026-08-01',
      dateTo: '2026-07-01',
    });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('invalid_request');
  });
});
