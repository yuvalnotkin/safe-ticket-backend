import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import request from 'supertest';
import { app } from '../helpers';
import { loginAs, LoginResult } from '../auth-helpers';
import { supabaseAdmin } from '../../src/utils/supabase';

let aviv: LoginResult;

beforeAll(async () => {
  aviv = await loginAs('aviv.cohen@example.com', 'password');
});

afterEach(async () => {
  await supabaseAdmin
    .from('provider_sessions')
    .delete()
    .eq('user_id', aviv.userId);
});

const startAuth = async (provider: string) => {
  const res = await request(app)
    .post('/api/sell/start-auth')
    .set('Authorization', `Bearer ${aviv.token}`)
    .send({ provider });
  return res.body as { authUrl: string; state: string };
};

const postCallback = (body: object, token: string = aviv.token) =>
  request(app)
    .post('/api/sell/callback')
    .set('Authorization', `Bearer ${token}`)
    .send(body);

describe('POST /api/sell/callback', () => {
  it('200 happy path — returns providerUserId + expiresAt and persists provider_sessions row', async () => {
    const { state } = await startAuth('eventim_il');
    const res = await postCallback({ provider: 'eventim_il', code: 'mock', state });

    expect(res.status).toBe(200);
    expect(typeof res.body.providerUserId).toBe('string');
    expect(res.body.providerUserId.length).toBeGreaterThan(0);
    expect(typeof res.body.expiresAt).toBe('number');
    expect(res.body.expiresAt).toBeGreaterThan(Math.floor(Date.now() / 1000));

    const { data } = await supabaseAdmin
      .from('provider_sessions')
      .select('*')
      .eq('user_id', aviv.userId)
      .eq('provider', 'eventim_il')
      .single();
    expect(data).toBeTruthy();
    expect(data!.provider_user_id).toBe(res.body.providerUserId);
    expect(typeof data!.access_token).toBe('string');
    expect(data!.access_token.length).toBeGreaterThan(0);
    expect(new Date(data!.expires_at).getTime() / 1000).toBeCloseTo(
      res.body.expiresAt,
      -1,
    );
  });

  it('never returns the access_token in the response body', async () => {
    const { state } = await startAuth('eventim_il');
    const res = await postCallback({ provider: 'eventim_il', code: 'mock', state });

    expect(res.status).toBe(200);
    expect(Object.keys(res.body).sort()).toEqual(['expiresAt', 'providerUserId']);
    expect(res.body.accessToken).toBeUndefined();
    expect(res.body.refreshToken).toBeUndefined();
  });

  it('re-running callback for the same (user, provider) UPSERTs in place — no second row, latest data wins', async () => {
    const first = await startAuth('eventim_il');
    await postCallback({ provider: 'eventim_il', code: 'mock', state: first.state });

    const { data: firstRow } = await supabaseAdmin
      .from('provider_sessions')
      .select('id, access_token, updated_at')
      .eq('user_id', aviv.userId)
      .eq('provider', 'eventim_il')
      .single();

    // small pause so updated_at strictly bumps
    await new Promise((r) => setTimeout(r, 25));

    const second = await startAuth('eventim_il');
    await postCallback({ provider: 'eventim_il', code: 'mock', state: second.state });

    const { data: allRows } = await supabaseAdmin
      .from('provider_sessions')
      .select('id, access_token, updated_at')
      .eq('user_id', aviv.userId)
      .eq('provider', 'eventim_il');
    expect(allRows!.length).toBe(1);
    expect(allRows![0].id).toBe(firstRow!.id);
    expect(allRows![0].access_token).not.toBe(firstRow!.access_token);
    expect(new Date(allRows![0].updated_at).getTime()).toBeGreaterThan(
      new Date(firstRow!.updated_at).getTime(),
    );
  });

  it('400 callback_failed when state is unknown / expired (connector rejects)', async () => {
    const res = await postCallback({
      provider: 'eventim_il',
      code: 'mock',
      state: 'not-a-real-state-token',
    });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('callback_failed');
  });

  it('400 callback_failed when state was issued for a different provider', async () => {
    const { state } = await startAuth('eventim_il');
    const res = await postCallback({ provider: 'hala', code: 'mock', state });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('callback_failed');
  });

  it('400 invalid_request when provider is unknown', async () => {
    const res = await postCallback({ provider: 'ticketmaster', code: 'x', state: 'x' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('invalid_request');
  });

  it('400 invalid_request on unrecognized body keys (strict)', async () => {
    const { state } = await startAuth('eventim_il');
    const res = await postCallback({
      provider: 'eventim_il',
      code: 'x',
      state,
      extra: 'nope',
    });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('invalid_request');
  });

  it('401 unauthorized without token', async () => {
    const res = await request(app)
      .post('/api/sell/callback')
      .send({ provider: 'eventim_il', code: 'x', state: 'x' });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('unauthorized');
  });
});
