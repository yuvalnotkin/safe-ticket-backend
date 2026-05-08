import { describe, it, expect } from 'vitest';
import {
  mapRowToListing,
  ListingsSearchRow,
  ListingResponse,
} from '../../src/services/listings.mapper';

const rowFixture = (
  overrides: Partial<ListingsSearchRow> = {},
): ListingsSearchRow => ({
  listing_id: '11111111-1111-1111-1111-111111111111',
  status: 'active',
  listing_created_at: '2026-04-30T08:00:00.000Z',
  listing_published_at: '2026-04-30T08:00:00.000Z',
  ticket_id: '22222222-2222-2222-2222-222222222222',
  section: '5',
  row_label: '12',
  seat: '8',
  face_value_agorot: 25000,
  total_price_agorot: 27500,
  event_id: '33333333-3333-3333-3333-333333333333',
  event_title: 'Hapoel TLV vs. Maccabi',
  event_type: 'sport',
  venue_name: 'Bloomfield Stadium',
  city: 'Tel Aviv',
  starts_at: '2026-06-15T20:00:00.000Z',
  provider_slug: 'leaan',
  ...overrides,
});

describe('mapRowToListing', () => {
  it('maps the API_CONTRACT example shape correctly', () => {
    const row = rowFixture();
    const result = mapRowToListing(row);

    const expected: ListingResponse = {
      id: '11111111-1111-1111-1111-111111111111',
      status: 'active',
      event: {
        name: 'Hapoel TLV vs. Maccabi',
        date: '2026-06-15T20:00:00.000Z',
        venue: 'Bloomfield Stadium',
        city: 'Tel Aviv',
        category: 'sports',
      },
      seat: {
        section: '5',
        row: '12',
        seat: '8',
      },
      price: {
        faceValueAgorot: 25000,
        serviceFeeAgorot: 2500,
      },
      provider: 'leaan',
      createdAt: '2026-04-30T08:00:00.000Z',
    };

    expect(result).toEqual(expected);
  });

  it('maps category: sport → sports, others → culture', () => {
    expect(mapRowToListing(rowFixture({ event_type: 'sport' })).event.category).toBe('sports');
    expect(mapRowToListing(rowFixture({ event_type: 'concert' })).event.category).toBe('culture');
    expect(mapRowToListing(rowFixture({ event_type: 'theater' })).event.category).toBe('culture');
    expect(mapRowToListing(rowFixture({ event_type: 'festival' })).event.category).toBe('culture');
    expect(mapRowToListing(rowFixture({ event_type: 'other' })).event.category).toBe('culture');
  });

  it('preserves explicit nulls for GA tickets (no seat info)', () => {
    const result = mapRowToListing(
      rowFixture({ section: null, row_label: null, seat: null }),
    );
    expect(result.seat).toEqual({ section: null, row: null, seat: null });
    // Must be explicit null, not undefined
    expect(result.seat.section).toBeNull();
    expect(result.seat.row).toBeNull();
    expect(result.seat.seat).toBeNull();
  });

  it('passes provider_slug through as provider', () => {
    const result = mapRowToListing(rowFixture({ provider_slug: 'eventim_il' }));
    expect(result.provider).toBe('eventim_il');
  });

  it('does not leak DB-only column names into the response', () => {
    const result = mapRowToListing(rowFixture()) as Record<string, unknown>;
    const keys = Object.keys(result);
    const dbOnlyKeys = [
      'row_label',
      'event_id',
      'ticket_id',
      'listing_published_at',
      'total_price_agorot',
      'event_type',
      'provider_slug',
      'face_value_agorot',
    ];
    for (const k of dbOnlyKeys) {
      expect(keys, `key "${k}" should not be in response`).not.toContain(k);
    }
  });

  it('createdAt and event.date are valid ISO strings', () => {
    const result = mapRowToListing(rowFixture());
    expect(isFinite(new Date(result.createdAt).getTime())).toBe(true);
    expect(isFinite(new Date(result.event.date).getTime())).toBe(true);
  });
});
