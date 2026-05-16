import { beforeEach, describe, expect, it } from 'vitest';
import {
  PROVIDER_SLUGS,
  ProviderSlug,
} from '../../src/connectors/types';
import { mockConnector, __resetMockState } from '../../src/connectors/mock';

const userId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

describe('mockConnector — startAuth + handleCallback', () => {
  beforeEach(() => {
    __resetMockState();
  });

  for (const provider of PROVIDER_SLUGS) {
    it(`startAuth(${provider}) returns an authUrl pointing at the mock-provider authorize route + an opaque state`, async () => {
      const { authUrl, state } = await mockConnector.startAuth({ provider, userId });

      expect(typeof state).toBe('string');
      expect(state.length).toBeGreaterThan(0);

      const url = new URL(authUrl);
      expect(url.pathname).toBe('/api/sell/mock-provider/authorize');
      expect(url.searchParams.get('state')).toBe(state);
      expect(url.searchParams.get('provider')).toBe(provider);
    });

    it(`handleCallback(${provider}) exchanges a valid state for a stable providerUserId`, async () => {
      const { state } = await mockConnector.startAuth({ provider, userId });
      const result = await mockConnector.handleCallback({
        provider,
        code: 'mock-code',
        state,
      });

      expect(typeof result.providerUserId).toBe('string');
      expect(result.providerUserId.length).toBeGreaterThan(0);
      expect(typeof result.accessToken).toBe('string');
      expect(result.accessToken.length).toBeGreaterThan(0);
      expect(typeof result.expiresAt).toBe('number');
      expect(result.expiresAt).toBeGreaterThan(Math.floor(Date.now() / 1000));
    });
  }

  it('handleCallback is stable: re-running auth for same (userId, provider) yields the same providerUserId', async () => {
    const provider: ProviderSlug = 'eventim_il';
    const first = await mockConnector.startAuth({ provider, userId });
    const firstCallback = await mockConnector.handleCallback({
      provider,
      code: 'mock-code',
      state: first.state,
    });

    const second = await mockConnector.startAuth({ provider, userId });
    const secondCallback = await mockConnector.handleCallback({
      provider,
      code: 'mock-code',
      state: second.state,
    });

    expect(secondCallback.providerUserId).toBe(firstCallback.providerUserId);
  });

  it('different (userId, provider) pairs yield different providerUserIds', async () => {
    const otherUserId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

    const a = await mockConnector.startAuth({ provider: 'eventim_il', userId });
    const cb1 = await mockConnector.handleCallback({
      provider: 'eventim_il',
      code: 'x',
      state: a.state,
    });

    const b = await mockConnector.startAuth({ provider: 'eventim_il', userId: otherUserId });
    const cb2 = await mockConnector.handleCallback({
      provider: 'eventim_il',
      code: 'x',
      state: b.state,
    });

    const c = await mockConnector.startAuth({ provider: 'hala', userId });
    const cb3 = await mockConnector.handleCallback({
      provider: 'hala',
      code: 'x',
      state: c.state,
    });

    expect(cb1.providerUserId).not.toBe(cb2.providerUserId);
    expect(cb1.providerUserId).not.toBe(cb3.providerUserId);
  });

  it('handleCallback rejects an unknown state', async () => {
    await expect(
      mockConnector.handleCallback({
        provider: 'eventim_il',
        code: 'x',
        state: 'not-a-real-state-token',
      }),
    ).rejects.toThrow(/state/i);
  });

  it('handleCallback rejects state for a different provider than was issued', async () => {
    const { state } = await mockConnector.startAuth({
      provider: 'eventim_il',
      userId,
    });
    await expect(
      mockConnector.handleCallback({ provider: 'hala', code: 'x', state }),
    ).rejects.toThrow(/state/i);
  });

  it('handleCallback consumes the state — a second use of the same state is rejected', async () => {
    const { state } = await mockConnector.startAuth({
      provider: 'eventim_il',
      userId,
    });
    await mockConnector.handleCallback({
      provider: 'eventim_il',
      code: 'x',
      state,
    });
    await expect(
      mockConnector.handleCallback({ provider: 'eventim_il', code: 'x', state }),
    ).rejects.toThrow(/state/i);
  });
});
