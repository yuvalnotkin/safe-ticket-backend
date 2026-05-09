import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL!;
const anonKey = process.env.SUPABASE_ANON_KEY!;

export interface LoginResult {
  token: string;
  userId: string;
}

/**
 * Sign a seeded user in against the local Supabase and return their JWT.
 * Tests use this in beforeAll to obtain a real bearer token for authed routes.
 * Uses a fresh client per call so test files don't share session state.
 */
export const loginAs = async (
  email: string,
  password: string,
): Promise<LoginResult> => {
  const client = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error || !data.session || !data.user) {
    throw new Error(`loginAs failed for ${email}: ${error?.message ?? 'no session'}`);
  }
  return { token: data.session.access_token, userId: data.user.id };
};
