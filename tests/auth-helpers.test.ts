import { describe, it, expect } from 'vitest';
import { loginAs } from './auth-helpers';

describe('loginAs', () => {
  it('returns a JWT and user id for a seeded user', async () => {
    const { token, userId } = await loginAs('aviv.cohen@example.com', 'password');
    expect(typeof token).toBe('string');
    expect(token.length).toBeGreaterThan(20);
    expect(userId).toBe('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
  });

  it('throws for invalid credentials', async () => {
    await expect(
      loginAs('aviv.cohen@example.com', 'wrong-password'),
    ).rejects.toThrow();
  });
});
