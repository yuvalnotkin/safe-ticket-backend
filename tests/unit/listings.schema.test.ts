import { describe, it, expect } from 'vitest';
import { listingsSearchSchema } from '../../src/routes/listings.schema';

describe('listingsSearchSchema', () => {
  it('parse({}) returns defaults: sort=soonest, page=1, limit=20', () => {
    const result = listingsSearchSchema.parse({});
    expect(result.sort).toBe('soonest');
    expect(result.page).toBe(1);
    expect(result.limit).toBe(20);
  });

  it('parse({}) has no extra optional fields present (all undefined)', () => {
    const result = listingsSearchSchema.parse({});
    expect(result.q).toBeUndefined();
    expect(result.category).toBeUndefined();
    expect(result.cities).toBeUndefined();
    expect(result.providers).toBeUndefined();
    expect(result.dateFrom).toBeUndefined();
    expect(result.dateTo).toBeUndefined();
    expect(result.minPriceAgorot).toBeUndefined();
    expect(result.maxPriceAgorot).toBeUndefined();
  });

  it('safeParse({ limit: "500" }).success === false (over max of 100)', () => {
    expect(listingsSearchSchema.safeParse({ limit: '500' }).success).toBe(false);
  });

  it('safeParse({ limit: "0" }).success === false (under min of 1)', () => {
    expect(listingsSearchSchema.safeParse({ limit: '0' }).success).toBe(false);
  });

  it('safeParse({ page: "0" }).success === false (under min of 1)', () => {
    expect(listingsSearchSchema.safeParse({ page: '0' }).success).toBe(false);
  });

  it('parse({ page: "3", limit: "50" }) coerces strings to numbers', () => {
    const result = listingsSearchSchema.parse({ page: '3', limit: '50' });
    expect(result.page).toBe(3);
    expect(result.limit).toBe(50);
  });

  it('parse({ cities: "Tel Aviv, Haifa" }) splits and trims CSV', () => {
    const result = listingsSearchSchema.parse({ cities: 'Tel Aviv, Haifa' });
    expect(result.cities).toEqual(['Tel Aviv', 'Haifa']);
  });

  it('parse({ providers: "leaan,eventim_il" }) splits CSV', () => {
    const result = listingsSearchSchema.parse({ providers: 'leaan,eventim_il' });
    expect(result.providers).toEqual(['leaan', 'eventim_il']);
  });

  it('safeParse({ category: "invalid" }).success === false', () => {
    expect(listingsSearchSchema.safeParse({ category: 'invalid' }).success).toBe(false);
  });

  it('safeParse({ sort: "oldest" }).success === false', () => {
    expect(listingsSearchSchema.safeParse({ sort: 'oldest' }).success).toBe(false);
  });

  it('safeParse({ dateFrom: "2026/06/15" }).success === false (regex requires YYYY-MM-DD)', () => {
    expect(listingsSearchSchema.safeParse({ dateFrom: '2026/06/15' }).success).toBe(false);
  });

  it('safeParse({ dateFrom: "2026-08-01", dateTo: "2026-07-01" }).success === false (dateTo before dateFrom)', () => {
    expect(
      listingsSearchSchema.safeParse({ dateFrom: '2026-08-01', dateTo: '2026-07-01' }).success,
    ).toBe(false);
  });

  it('safeParse({ minPriceAgorot: "50", maxPriceAgorot: "10" }).success === false', () => {
    expect(
      listingsSearchSchema.safeParse({ minPriceAgorot: '50', maxPriceAgorot: '10' }).success,
    ).toBe(false);
  });

  it('safeParse({ minPriceAgorot: "0", maxPriceAgorot: "0" }).success === true (equal is OK)', () => {
    expect(
      listingsSearchSchema.safeParse({ minPriceAgorot: '0', maxPriceAgorot: '0' }).success,
    ).toBe(true);
  });

  it('safeParse({ q: "   " }).success === false (after trim, empty string rejected by min(1))', () => {
    expect(listingsSearchSchema.safeParse({ q: '   ' }).success).toBe(false);
  });

  it('parse({ q: "  Hapoel  " }) trims to "Hapoel"', () => {
    const result = listingsSearchSchema.parse({ q: '  Hapoel  ' });
    expect(result.q).toBe('Hapoel');
  });
});
