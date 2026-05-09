import { supabaseAdmin } from '../utils/supabase';
import { AppError } from '../middleware/error';

export interface ProfileResponse {
  id: string;
  email: string;
  displayName: string;
  phone: string | null;
  avatarUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProfilePatch {
  displayName?: string;
  phone?: string | null;
  avatarUrl?: string | null;
}

interface ProfileRow {
  id: string;
  display_name: string;
  phone: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

const fetchAuthEmail = async (userId: string): Promise<string> => {
  const { data, error } = await supabaseAdmin.auth.admin.getUserById(userId);
  if (error || !data.user) {
    throw new AppError(404, 'user_not_found', 'User not found');
  }
  return data.user.email ?? '';
};

const fetchProfileRow = async (userId: string): Promise<ProfileRow> => {
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('id, display_name, phone, avatar_url, created_at, updated_at')
    .eq('id', userId)
    .maybeSingle();
  if (error) {
    throw new AppError(500, 'profile_lookup_failed', error.message);
  }
  if (!data) {
    throw new AppError(404, 'user_not_found', 'Profile not found for this user');
  }
  return data as ProfileRow;
};

const mapRowToProfileResponse = (row: ProfileRow, email: string): ProfileResponse => ({
  id: row.id,
  email,
  displayName: row.display_name,
  phone: row.phone,
  avatarUrl: row.avatar_url,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export const getProfile = async (userId: string): Promise<ProfileResponse> => {
  const [email, row] = await Promise.all([
    fetchAuthEmail(userId),
    fetchProfileRow(userId),
  ]);
  return mapRowToProfileResponse(row, email);
};

export const updateProfile = async (
  userId: string,
  input: ProfilePatch,
): Promise<ProfileResponse> => {
  // Verify auth user + profile exist before attempting update.
  const [email] = await Promise.all([
    fetchAuthEmail(userId),
    fetchProfileRow(userId),
  ]);

  const patch: Record<string, unknown> = {};
  if (input.displayName !== undefined) patch.display_name = input.displayName;
  if (input.phone !== undefined) patch.phone = input.phone;
  if (input.avatarUrl !== undefined) patch.avatar_url = input.avatarUrl;
  // Empty patch — force the row to be touched so the BEFORE-UPDATE trigger
  // bumps updated_at. The DB trigger overrides whatever timestamp we send;
  // this column is only here to satisfy the SET-clause requirement.
  if (Object.keys(patch).length === 0) {
    patch.updated_at = new Date().toISOString();
  }

  const { data, error } = await supabaseAdmin
    .from('profiles')
    .update(patch)
    .eq('id', userId)
    .select('id, display_name, phone, avatar_url, created_at, updated_at')
    .single();
  if (error || !data) {
    throw new AppError(
      500,
      'profile_update_failed',
      error?.message ?? 'No row returned',
    );
  }
  return mapRowToProfileResponse(data as ProfileRow, email);
};
