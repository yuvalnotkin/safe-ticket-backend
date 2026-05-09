import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { app } from '../helpers';
import { loginAs } from '../auth-helpers';
import { supabaseAdmin } from '../../src/utils/supabase';

const AVIV_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
let token: string;
let snap: { display_name: string; phone: string | null; avatar_url: string | null };

beforeAll(async () => {
  ({ token } = await loginAs('aviv.cohen@example.com', 'password'));
});

beforeEach(async () => {
  const { data } = await supabaseAdmin
    .from('profiles')
    .select('display_name, phone, avatar_url')
    .eq('id', AVIV_ID)
    .single();
  snap = data!;
});

afterEach(async () => {
  await supabaseAdmin
    .from('profiles')
    .update({
      display_name: snap.display_name,
      phone: snap.phone,
      avatar_url: snap.avatar_url,
    })
    .eq('id', AVIV_ID);
});

const authedPut = (body: object) =>
  request(app)
    .put('/api/users/me/profile')
    .set('Authorization', `Bearer ${token}`)
    .send(body);

const authedGet = () =>
  request(app)
    .get('/api/users/me/profile')
    .set('Authorization', `Bearer ${token}`);

describe('PUT /api/users/me/profile', () => {
  it('200 happy path — full body updates all three fields', async () => {
    const res = await authedPut({
      displayName: 'Aviv C.',
      phone: '+972-50-9876543',
      avatarUrl: 'https://example.com/a.jpg',
    });
    expect(res.status).toBe(200);
    expect(res.body.displayName).toBe('Aviv C.');
    expect(res.body.phone).toBe('+972-50-9876543');
    expect(res.body.avatarUrl).toBe('https://example.com/a.jpg');
  });

  it('200 partial — omitted fields unchanged', async () => {
    const before = (await authedGet()).body;
    const res = await authedPut({ displayName: 'Aviv X.' });
    expect(res.status).toBe(200);
    expect(res.body.displayName).toBe('Aviv X.');
    expect(res.body.phone).toBe(before.phone);
    expect(res.body.avatarUrl).toBe(before.avatarUrl);
  });

  it('200 avatarUrl: null clears the field', async () => {
    await authedPut({ avatarUrl: 'https://example.com/a.jpg' });
    const res = await authedPut({ avatarUrl: null });
    expect(res.status).toBe(200);
    expect(res.body.avatarUrl).toBeNull();
  });

  it('200 empty body bumps updatedAt without changing other fields', async () => {
    const before = (await authedGet()).body;
    await new Promise((r) => setTimeout(r, 25));
    const res = await authedPut({});
    expect(res.status).toBe(200);
    expect(new Date(res.body.updatedAt).getTime()).toBeGreaterThan(
      new Date(before.updatedAt).getTime(),
    );
    expect(res.body.displayName).toBe(before.displayName);
    expect(res.body.phone).toBe(before.phone);
    expect(res.body.avatarUrl).toBe(before.avatarUrl);
  });

  it('400 invalid_request when displayName is whitespace-only', async () => {
    const res = await authedPut({ displayName: '   ' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('invalid_request');
  });

  it('400 invalid_request when phone does not match regex', async () => {
    const res = await authedPut({ phone: 'abc' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('invalid_request');
  });

  it('400 invalid_request when avatarUrl is not a URL', async () => {
    const res = await authedPut({ avatarUrl: 'not-a-url' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('invalid_request');
  });

  it('400 invalid_request when body includes email (strict)', async () => {
    const res = await authedPut({ email: 'new@x.com' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('invalid_request');
  });

  it('401 unauthorized without token', async () => {
    const res = await request(app).put('/api/users/me/profile').send({});
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('unauthorized');
  });
});
