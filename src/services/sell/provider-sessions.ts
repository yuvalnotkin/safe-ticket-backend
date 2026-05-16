import { supabaseAdmin } from '../../utils/supabase';
import { AppError } from '../../middleware/error';
import { CallbackResult, ProviderSlug } from '../../connectors';

export interface ProviderSessionRow {
  id: string;
  user_id: string;
  provider: ProviderSlug;
  provider_user_id: string;
  access_token: string;
  refresh_token: string | null;
  expires_at: string;
}

export const upsertProviderSession = async (
  userId: string,
  provider: ProviderSlug,
  callback: CallbackResult,
): Promise<void> => {
  const expiresAtIso = new Date(callback.expiresAt * 1000).toISOString();
  const { error } = await supabaseAdmin.from('provider_sessions').upsert(
    {
      user_id: userId,
      provider,
      provider_user_id: callback.providerUserId,
      access_token: callback.accessToken,
      refresh_token: callback.refreshToken ?? null,
      expires_at: expiresAtIso,
      // updated_at is bumped by the trigger; setting it ensures the UPDATE
      // branch of UPSERT actually touches the row.
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,provider' },
  );
  if (error) {
    throw new AppError(500, 'provider_session_upsert_failed', error.message);
  }
};

/**
 * Returns the stored session row for (userId, provider), or null if missing
 * or expired. Callers should treat null as 409 no_provider_session.
 */
export const getActiveProviderSession = async (
  userId: string,
  provider: ProviderSlug,
): Promise<ProviderSessionRow | null> => {
  const { data, error } = await supabaseAdmin
    .from('provider_sessions')
    .select('id, user_id, provider, provider_user_id, access_token, refresh_token, expires_at')
    .eq('user_id', userId)
    .eq('provider', provider)
    .maybeSingle();
  if (error) {
    throw new AppError(500, 'provider_session_lookup_failed', error.message);
  }
  if (!data) return null;
  const row = data as ProviderSessionRow;
  if (new Date(row.expires_at).getTime() <= Date.now()) {
    return null;
  }
  return row;
};
