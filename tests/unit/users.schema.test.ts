import { describe, it, expect } from 'vitest';
import { updateProfileSchema } from '../../src/routes/users.schema';

describe('updateProfileSchema', () => {
  it('accepts an empty object', () => {
    expect(updateProfileSchema.safeParse({}).success).toBe(true);
  });

  it('accepts all three fields with valid values', () => {
    const r = updateProfileSchema.safeParse({
      displayName: 'Aviv C.',
      phone: '+972-50-1234567',
      avatarUrl: 'https://example.com/a.jpg',
    });
    expect(r.success).toBe(true);
  });

  it('accepts phone: null and avatarUrl: null', () => {
    const r = updateProfileSchema.safeParse({ phone: null, avatarUrl: null });
    expect(r.success).toBe(true);
    expect(r.data).toEqual({ phone: null, avatarUrl: null });
  });

  it('trims displayName and rejects empty after trim', () => {
    expect(updateProfileSchema.safeParse({ displayName: '  Aviv  ' }).data?.displayName).toBe('Aviv');
    expect(updateProfileSchema.safeParse({ displayName: '   ' }).success).toBe(false);
  });

  it('rejects displayName longer than 80 chars', () => {
    expect(updateProfileSchema.safeParse({ displayName: 'a'.repeat(81) }).success).toBe(false);
  });

  it('phone regex — accepts 10-char valid, rejects too-short, rejects garbage', () => {
    expect(updateProfileSchema.safeParse({ phone: '+972-50-12' }).success).toBe(true); // 10 chars, regex-valid
    expect(updateProfileSchema.safeParse({ phone: '12' }).success).toBe(false); // <7
    expect(updateProfileSchema.safeParse({ phone: 'abc' }).success).toBe(false);
  });

  it('rejects avatarUrl that is not a URL', () => {
    expect(updateProfileSchema.safeParse({ avatarUrl: 'not-a-url' }).success).toBe(false);
  });

  it('rejects unknown keys (strict) — including email', () => {
    const r = updateProfileSchema.safeParse({ email: 'new@x.com' });
    expect(r.success).toBe(false);
    if (!r.success) {
      // zod v4: unrecognized_keys issues carry the key names in `keys`, not `path`
      const unknownKeyIssue = r.error.issues.find(
        (i) => i.code === 'unrecognized_keys' && (i as { keys: string[] }).keys.includes('email'),
      );
      expect(unknownKeyIssue).toBeDefined();
    }
  });
});
