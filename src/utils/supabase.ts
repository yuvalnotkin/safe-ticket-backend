import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { env } from './env';

// Service-role client. Bypasses RLS. Use only in trusted server code.
export const supabaseAdmin: SupabaseClient = createClient(
  env.SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  },
);

// Anon client. Used for password-flow signup/login that should produce a
// real user session without bypassing RLS.
export const supabaseAnon: SupabaseClient = createClient(
  env.SUPABASE_URL,
  env.SUPABASE_ANON_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  },
);
