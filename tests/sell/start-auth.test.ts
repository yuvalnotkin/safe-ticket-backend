import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../helpers';
import { loginAs } from '../auth-helpers';

let token: string;

beforeAll(async () => {
  ({ token } = await loginAs('aviv.cohen@example.com', 'password'));
});

const authedPost = (body: object) =>
  request(app)
    .post('/api/sell/start-auth')
    .set('Authorization', `Bearer ${token}`)
    .send(body);

describe('POST /api/sell/start-auth', () => {
  it('200 happy path — returns authUrl containing provider + state query params', async () => {
    const res = await authedPost({ provider: 'eventim_il' });

    expect(res.status).toBe(200);
    expect(typeof res.body.authUrl).toBe('string');
    expect(typeof res.body.state).toBe('string');
    expect(res.body.state.length).toBeGreaterThan(0);

    const url = new URL(res.body.authUrl);
    expect(url.pathname).toBe('/api/sell/mock-provider/authorize');
    expect(url.searchParams.get('provider')).toBe('eventim_il');
    expect(url.searchParams.get('state')).toBe(res.body.state);
  });

  it('200 for every supported provider slug', async () => {
    for (const provider of ['eventim_il', 'hala', 'leaan', 'tmura']) {
      const res = await authedPost({ provider });
      expect(res.status).toBe(200);
      expect(new URL(res.body.authUrl).searchParams.get('provider')).toBe(provider);
    }
  });

  it('400 invalid_request when provider is an unknown slug', async () => {
    const res = await authedPost({ provider: 'ticketmaster' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('invalid_request');
  });

  it('400 invalid_request when provider is missing', async () => {
    const res = await authedPost({});
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('invalid_request');
  });

  it('400 invalid_request on unrecognized body keys (strict)', async () => {
    const res = await authedPost({ provider: 'eventim_il', extra: 'nope' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('invalid_request');
  });

  it('401 unauthorized without a Bearer token', async () => {
    const res = await request(app)
      .post('/api/sell/start-auth')
      .send({ provider: 'eventim_il' });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('unauthorized');
  });
});
