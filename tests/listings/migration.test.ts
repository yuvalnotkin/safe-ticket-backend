import { describe, it, expect } from 'vitest';
import { supabaseAdmin } from '../../src/utils/supabase';

describe('listings_search view', () => {
  it('exposes total_price_agorot = face + floor(face/10)', async () => {
    const { data, error } = await supabaseAdmin
      .from('listings_search')
      .select('listing_id, face_value_agorot, total_price_agorot, status')
      .eq('status', 'active')
      .limit(1)
      .single();
    expect(error).toBeNull();
    expect(data).not.toBeNull();
    expect(data!.total_price_agorot).toBe(
      data!.face_value_agorot + Math.floor(data!.face_value_agorot / 10),
    );
  });

  it('only contains rows joinable across listings ⨝ tickets ⨝ events ⨝ providers', async () => {
    const { data, error } = await supabaseAdmin
      .from('listings_search')
      .select('listing_id, ticket_id, event_id, provider_slug, event_title, venue_name, city, starts_at')
      .limit(5);
    expect(error).toBeNull();
    expect(data).not.toBeNull();
    expect(data!.length).toBeGreaterThan(0);
    for (const row of data!) {
      expect(row.listing_id).toBeTruthy();
      expect(row.ticket_id).toBeTruthy();
      expect(row.event_id).toBeTruthy();
      expect(row.provider_slug).toBeTruthy();
      expect(row.event_title).toBeTruthy();
      expect(row.venue_name).toBeTruthy();
      expect(row.city).toBeTruthy();
      expect(row.starts_at).toBeTruthy();
    }
  });
});
