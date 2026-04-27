import { supabaseAdmin, supabaseAnon } from '../utils/supabase';
import { AppError } from '../middleware/error';

export interface AuthResult {
  user: { id: string; email: string; displayName: string };
  session: { accessToken: string; refreshToken: string; expiresAt: number };
}

const toSession = (session: {
  access_token: string;
  refresh_token: string;
  expires_at?: number;
}) => ({
  accessToken: session.access_token,
  refreshToken: session.refresh_token,
  expiresAt: session.expires_at ?? 0,
});

export const signup = async (
  email: string,
  password: string,
  displayName: string,
): Promise<AuthResult> => {
  const { data, error } = await supabaseAnon.auth.signUp({ email, password });

  if (error) {
    throw new AppError(400, 'signup_failed', error.message);
  }
  if (!data.user || !data.session) {
    throw new AppError(
      500,
      'signup_failed',
      'Sign-up did not return a session. Email confirmation may be enabled.',
    );
  }

  const { error: profileError } = await supabaseAdmin
    .from('profiles')
    .insert({ id: data.user.id, display_name: displayName });

  if (profileError) {
    // Roll back the auth user so signup is atomic from the client's POV.
    await supabaseAdmin.auth.admin.deleteUser(data.user.id);
    throw new AppError(500, 'profile_create_failed', profileError.message);
  }

  return {
    user: { id: data.user.id, email: data.user.email ?? email, displayName },
    session: toSession(data.session),
  };
};

export const login = async (email: string, password: string): Promise<AuthResult> => {
  const { data, error } = await supabaseAnon.auth.signInWithPassword({ email, password });

  if (error || !data.user || !data.session) {
    throw new AppError(401, 'invalid_credentials', 'Invalid email or password');
  }

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('display_name')
    .eq('id', data.user.id)
    .maybeSingle();

  return {
    user: {
      id: data.user.id,
      email: data.user.email ?? email,
      displayName: profile?.display_name ?? '',
    },
    session: toSession(data.session),
  };
};

export const logout = async (accessToken: string): Promise<void> => {
  // 'global' revokes the refresh token so the session can't be renewed.
  const { error } = await supabaseAdmin.auth.admin.signOut(accessToken, 'global');
  if (error) {
    throw new AppError(400, 'logout_failed', error.message);
  }
};

export const getMe = async (userId: string) => {
  const { data: userResp, error: userErr } = await supabaseAdmin.auth.admin.getUserById(userId);
  if (userErr || !userResp.user) {
    throw new AppError(404, 'user_not_found', 'User not found');
  }

  const { data: profile, error: profileErr } = await supabaseAdmin
    .from('profiles')
    .select('display_name, phone, avatar_url, created_at, updated_at')
    .eq('id', userId)
    .maybeSingle();

  if (profileErr) {
    throw new AppError(500, 'profile_lookup_failed', profileErr.message);
  }

  return {
    id: userResp.user.id,
    email: userResp.user.email ?? '',
    displayName: profile?.display_name ?? '',
    phone: profile?.phone ?? null,
    avatarUrl: profile?.avatar_url ?? null,
    createdAt: profile?.created_at ?? userResp.user.created_at,
    updatedAt: profile?.updated_at ?? null,
  };
};
