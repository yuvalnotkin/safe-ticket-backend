import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../helpers';
import { env } from '../../src/utils/env';

const path = '/api/sell/mock-provider/authorize';

describe('GET /api/sell/mock-provider/authorize', () => {
  it('302 happy path — redirects to FRONTEND_URL/sell/callback with provider, code, echoed state', async () => {
    const res = await request(app)
      .get(path)
      .query({ state: 'opaque-state-abc', provider: 'eventim_il' });

    expect(res.status).toBe(302);
    const location = res.headers.location as string;
    expect(typeof location).toBe('string');

    const dest = new URL(location);
    const expectedBase = new URL('/sell/callback', env.FRONTEND_URL);
    expect(dest.origin).toBe(expectedBase.origin);
    expect(dest.pathname).toBe('/sell/callback');
    expect(dest.searchParams.get('provider')).toBe('eventim_il');
    expect(dest.searchParams.get('state')).toBe('opaque-state-abc');
    const code = dest.searchParams.get('code');
    expect(typeof code).toBe('string');
    expect(code!.length).toBeGreaterThan(0);
  });

  it('302 generates a different code on each call (mints a fresh nonce)', async () => {
    const a = await request(app)
      .get(path)
      .query({ state: 's1', provider: 'eventim_il' });
    const b = await request(app)
      .get(path)
      .query({ state: 's2', provider: 'eventim_il' });

    const codeA = new URL(a.headers.location as string).searchParams.get('code');
    const codeB = new URL(b.headers.location as string).searchParams.get('code');
    expect(codeA).not.toBe(codeB);
  });

  it('302 for every supported provider slug', async () => {
    for (const provider of ['eventim_il', 'hala', 'leaan', 'tmura']) {
      const res = await request(app)
        .get(path)
        .query({ state: `s-${provider}`, provider });
      expect(res.status).toBe(302);
      const dest = new URL(res.headers.location as string);
      expect(dest.searchParams.get('provider')).toBe(provider);
    }
  });

  it('400 invalid_request when state is missing', async () => {
    const res = await request(app).get(path).query({ provider: 'eventim_il' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('invalid_request');
  });

  it('400 invalid_request when provider is missing', async () => {
    const res = await request(app).get(path).query({ state: 'x' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('invalid_request');
  });

  it('400 invalid_request when provider is unknown', async () => {
    const res = await request(app)
      .get(path)
      .query({ state: 'x', provider: 'ticketmaster' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('invalid_request');
  });

  it('does not require an Authorization header — bouncing OAuth flow has no app credentials', async () => {
    const res = await request(app)
      .get(path)
      .query({ state: 'x', provider: 'eventim_il' });
    expect(res.status).toBe(302);
  });
});
