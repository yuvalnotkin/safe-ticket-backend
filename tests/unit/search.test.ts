import { describe, it, expect } from 'vitest';
import { sanitizeQueryTerm } from '../../src/utils/search';

describe('sanitizeQueryTerm', () => {
  it('strips commas', () => {
    expect(sanitizeQueryTerm('hello,world')).toBe('helloworld');
  });

  it('escapes LIKE wildcard characters % and _', () => {
    expect(sanitizeQueryTerm('a%b_c')).toBe('a\\%b\\_c');
  });

  it('strips parentheses and quotes', () => {
    expect(sanitizeQueryTerm('"(x)"')).toBe('x');
  });

  it('trims leading and trailing whitespace', () => {
    expect(sanitizeQueryTerm('  Hapoel  ')).toBe('Hapoel');
  });

  it('caps output at 80 characters', () => {
    const result = sanitizeQueryTerm('a'.repeat(200));
    expect(result.length).toBeLessThanOrEqual(80);
  });

  it('strips backslashes (defense against escape-sequence hacks)', () => {
    expect(sanitizeQueryTerm('a\\b')).toBe('ab');
  });

  it('is idempotent on clean input', () => {
    expect(sanitizeQueryTerm('Tel Aviv')).toBe('Tel Aviv');
  });
});
