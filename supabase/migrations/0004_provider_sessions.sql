-- Safe Ticket — Phase 3 Segment 2: provider_sessions
-- Persists `handleCallback`'s return value so subsequent sell endpoints can
-- look up the seller's provider access token by (user_id, provider). The
-- stub `provider_auth_sessions` from 0001 is superseded: that placeholder
-- predates the connector design and is dropped here.

-- =============================================================================
-- Drop the unused 0001 stub (no rows, no policies, no callers).
-- =============================================================================

drop table if exists public.provider_auth_sessions;

-- =============================================================================
-- provider_sessions — server-side store for seller provider access tokens.
-- =============================================================================

create table public.provider_sessions (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  -- Matches the connector ProviderSlug union (eventim_il | hala | leaan | tmura).
  -- Stored as text rather than FK to providers(slug) because the connector
  -- layer is the source of truth for which slugs are supported; the providers
  -- table is a catalog for the search view and may diverge in display metadata.
  provider          text not null,
  provider_user_id  text not null,
  -- Plain-text token storage is acceptable for the Phase-3 mock. Encryption
  -- at rest will be revisited when Phase 5 real connectors ship — real
  -- provider tokens are a much higher-value target than mock strings.
  access_token      text not null,
  refresh_token     text,
  expires_at        timestamptz not null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  -- One row per (user, provider); re-auth UPSERTs in place.
  unique (user_id, provider)
);

create index provider_sessions_user_provider_idx
  on public.provider_sessions (user_id, provider);

create trigger provider_sessions_set_updated_at
before update on public.provider_sessions
for each row execute function set_updated_at();

-- =============================================================================
-- RLS — deny all anon + authenticated access. Only the service-role client
-- (server-side) reads or writes this table; tokens must never be exposed to
-- clients, even indirectly.
-- =============================================================================

alter table public.provider_sessions enable row level security;

-- No policies = nothing visible to anon or authenticated callers. Service role
-- bypasses RLS by design.
