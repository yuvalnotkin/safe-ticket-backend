import { describe, it, expect } from 'vitest';
import {
  calculateServiceFeeAgorot,
  BUYER_SERVICE_FEE_BPS,
} from '../../src/utils/fees';

describe('calculateServiceFeeAgorot', () => {
  it('returns 0 for face value 0', () => {
    expect(calculateServiceFeeAgorot(0)).toBe(0);
  });

  it('returns 3500 for face value 35000', () => {
    expect(calculateServiceFeeAgorot(35000)).toBe(3500);
  });

  it('truncates fractional agorot (floor, not round): 199 → 19', () => {
    expect(calculateServiceFeeAgorot(199)).toBe(19);
  });

  it('throws for negative input', () => {
    expect(() => calculateServiceFeeAgorot(-1)).toThrow();
  });

  it('throws for non-integer input', () => {
    expect(() => calculateServiceFeeAgorot(1.5)).toThrow();
  });

  it('BUYER_SERVICE_FEE_BPS is 1000', () => {
    expect(BUYER_SERVICE_FEE_BPS).toBe(1000);
  });
});
