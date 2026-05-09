import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { supabaseAdmin } from '../../src/utils/supabase';
import { getProfile, updateProfile } from '../../src/services/profile';

const AVIV_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

const snapshot = async (id: string) => {
  const { data } = await supabaseAdmin
    .from('profiles')
    .select('display_name, phone, avatar_url')
    .eq('id', id)
    .single();
  return data!;
};

const restore = async (id: string, snap: any) => {
  await supabaseAdmin
    .from('profiles')
    .update({
      display_name: snap.display_name,
      phone: snap.phone,
      avatar_url: snap.avatar_url,
    })
    .eq('id', id);
};

describe('profileService.getProfile', () => {
  it('returns the merged profile shape for a seeded user', async () => {
    const p = await getProfile(AVIV_ID);
    expect(p.id).toBe(AVIV_ID);
    expect(p.email).toBeTruthy();
    expect(p.displayName).toBe('Aviv Cohen');
    expect(p.phone).toBe('+972-50-1234567');
    expect(p.avatarUrl).toBeNull();
    expect(typeof p.createdAt).toBe('string');
    expect(typeof p.updatedAt).toBe('string');
  });

  it('throws 404 user_not_found when no profile row exists', async () => {
    const ghostId = '99999999-9999-9999-9999-999999999999';
    await expect(getProfile(ghostId)).rejects.toMatchObject({
      status: 404,
      code: 'user_not_found',
    });
  });
});

describe('profileService.updateProfile', () => {
  let snap: any;
  beforeEach(async () => {
    snap = await snapshot(AVIV_ID);
  });
  afterEach(async () => {
    await restore(AVIV_ID, snap);
  });

  it('partial update — only changes provided fields', async () => {
    const before = await getProfile(AVIV_ID);
    const after = await updateProfile(AVIV_ID, { displayName: 'Aviv C.' });
    expect(after.displayName).toBe('Aviv C.');
    expect(after.phone).toBe(before.phone);
    expect(after.avatarUrl).toBe(before.avatarUrl);
  });

  it('null avatarUrl clears the field', async () => {
    await updateProfile(AVIV_ID, { avatarUrl: 'https://example.com/a.jpg' });
    const after = await updateProfile(AVIV_ID, { avatarUrl: null });
    expect(after.avatarUrl).toBeNull();
  });

  it('empty patch still bumps updatedAt', async () => {
    const before = await getProfile(AVIV_ID);
    await new Promise((r) => setTimeout(r, 25));
    const after = await updateProfile(AVIV_ID, {});
    expect(new Date(after.updatedAt).getTime()).toBeGreaterThan(
      new Date(before.updatedAt).getTime(),
    );
  });

  it('throws 404 user_not_found when no profile row exists', async () => {
    const ghostId = '99999999-9999-9999-9999-999999999999';
    await expect(
      updateProfile(ghostId, { displayName: 'X' }),
    ).rejects.toMatchObject({
      status: 404,
      code: 'user_not_found',
    });
  });
});
