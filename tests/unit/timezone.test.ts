import { describe, it, expect } from 'vitest';
import { resolveDateRange } from '../../src/utils/timezone';

describe('resolveDateRange', () => {
  it('converts dateFrom in IDT (UTC+3) to correct UTC start-of-day', () => {
    // 2026-06-15 00:00 IDT (UTC+3) = 2026-06-14T21:00:00.000Z
    const { dateFromUtc } = resolveDateRange('2026-06-15', undefined);
    expect(dateFromUtc).toBe('2026-06-14T21:00:00.000Z');
  });

  it('converts dateTo in IDT (UTC+3) to next-day-exclusive UTC bound', () => {
    // dateTo='2026-06-15' inclusive → next day is 2026-06-16 00:00 IDT = 2026-06-15T21:00:00.000Z
    const { dateToUtcExclusive } = resolveDateRange(undefined, '2026-06-15');
    expect(dateToUtcExclusive).toBe('2026-06-15T21:00:00.000Z');
  });

  it('converts dateFrom in IST (UTC+2) to correct UTC start-of-day (winter)', () => {
    // 2026-01-15 00:00 IST (UTC+2) = 2026-01-14T22:00:00.000Z
    const { dateFromUtc } = resolveDateRange('2026-01-15', undefined);
    expect(dateFromUtc).toBe('2026-01-14T22:00:00.000Z');
  });

  it('returns empty object when both args are undefined', () => {
    expect(resolveDateRange(undefined, undefined)).toEqual({});
  });

  it('returns both fields when both args are supplied', () => {
    const result = resolveDateRange('2026-06-15', '2026-06-20');
    expect(result.dateFromUtc).toBeDefined();
    expect(result.dateToUtcExclusive).toBeDefined();
  });

  it('DST seam: 2026-03-26 (still IST/UTC+2)', () => {
    // Israel switches IST→IDT on Friday 2026-03-27
    // 2026-03-26 is still IST (UTC+2) → 2026-03-25T22:00:00.000Z
    const { dateFromUtc } = resolveDateRange('2026-03-26', undefined);
    expect(dateFromUtc).toBe('2026-03-25T22:00:00.000Z');
  });

  it('DST seam: 2026-03-29 (now IDT/UTC+3)', () => {
    // 2026-03-29 is after the IDT switch → 2026-03-28T21:00:00.000Z
    const { dateFromUtc } = resolveDateRange('2026-03-29', undefined);
    expect(dateFromUtc).toBe('2026-03-28T21:00:00.000Z');
  });
});
