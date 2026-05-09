import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../helpers';
import { loginAs } from '../auth-helpers';
import { supabaseAdmin } from '../../src/utils/supabase';

const AVIV_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
let token: string;

beforeAll(async () => {
  ({ token } = await loginAs('aviv.cohen@example.com', 'password'));
});

describe('GET /api/users/me/profile', () => {
  it('200 returns the profile shape for the authed user', async () => {
    const res = await request(app)
      .get('/api/users/me/profile')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(AVIV_ID);
    expect(typeof res.body.email).toBe('string');
    expect(res.body.displayName).toBe('Aviv Cohen');
    expect(res.body.phone).toBe('+972-50-1234567');
    expect(res.body.avatarUrl).toBeNull();
    expect(typeof res.body.createdAt).toBe('string');
    expect(typeof res.body.updatedAt).toBe('string');
  });

  it('401 unauthorized when no Authorization header', async () => {
    const res = await request(app).get('/api/users/me/profile');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('unauthorized');
  });

  it('401 unauthorized when token is invalid', async () => {
    const res = await request(app)
      .get('/api/users/me/profile')
      .set('Authorization', 'Bearer not-a-real-token');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('unauthorized');
  });

  it('404 user_not_found when the profile row is missing', async () => {
    // Snapshot, delete, run, restore. Ensures no DB leakage even on assertion failure.
    const { data: snap } = await supabaseAdmin
      .from('profiles')
      .select('id, display_name, phone, avatar_url, created_at, updated_at')
      .eq('id', AVIV_ID)
      .single();
    if (!snap) throw new Error('seeded Aviv profile missing — re-seed before running this test');
    await supabaseAdmin.from('profiles').delete().eq('id', AVIV_ID);
    try {
      const res = await request(app)
        .get('/api/users/me/profile')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('user_not_found');
    } finally {
      await supabaseAdmin.from('profiles').insert({
        id: snap.id,
        display_name: snap.display_name,
        phone: snap.phone,
        avatar_url: snap.avatar_url,
        created_at: snap.created_at,
        updated_at: snap.updated_at,
      });
    }
  });
});
