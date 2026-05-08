import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../helpers';
import { supabaseAdmin } from '../../src/utils/supabase';

describe('GET /api/listings/:id', () => {
  let activeId: string;
  let soldId: string;

  beforeAll(async () => {
    // Pin a non-GA listing (non-null section) so the seat assertion is deterministic.
    const { data: activeData, error: activeError } = await supabaseAdmin
      .from('listings_search')
      .select('listing_id')
      .eq('status', 'active')
      .not('section', 'is', null)
      .limit(1)
      .single();
    if (activeError || !activeData) throw new Error('seed must contain at least one active non-GA listing');
    activeId = activeData.listing_id as string;

    const { data, error } = await supabaseAdmin
      .from('listings').select('id').eq('status', 'sold').limit(1).single();
    if (error || !data) throw new Error('seed must contain at least one sold listing');
    soldId = data.id as string;
  });

  it('returns 200 with full ListingResponse for an active id', async () => {
    const res = await request(app).get(`/api/listings/${activeId}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(activeId);
    expect(res.body.status).toBe('active');
    expect(typeof res.body.event.name).toBe('string');
    expect(typeof res.body.event.date).toBe('string');
    expect(typeof res.body.event.venue).toBe('string');
    expect(typeof res.body.event.city).toBe('string');
    expect(['sports', 'culture']).toContain(res.body.event.category);
    expect(res.body.seat).toEqual(
      expect.objectContaining({ section: expect.anything(), row: expect.anything(), seat: expect.anything() }),
    );
    expect(Number.isInteger(res.body.price.faceValueAgorot)).toBe(true);
    expect(Number.isInteger(res.body.price.serviceFeeAgorot)).toBe(true);
    expect(typeof res.body.provider).toBe('string');
    expect(typeof res.body.createdAt).toBe('string');
  });

  it('returns 404 listing_not_found for a valid uuid that does not exist', async () => {
    const ghostId = '00000000-0000-0000-0000-000000000000';
    const res = await request(app).get(`/api/listings/${ghostId}`);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('listing_not_found');
  });

  it('returns 404 for a sold listing (status filter — never leak non-active)', async () => {
    const res = await request(app).get(`/api/listings/${soldId}`);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('listing_not_found');
  });

  it('returns 400 invalid_request for a malformed uuid', async () => {
    const res = await request(app).get('/api/listings/not-a-uuid');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('invalid_request');
  });
});
