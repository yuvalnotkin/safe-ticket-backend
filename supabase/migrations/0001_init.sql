-- Safe Ticket — Phase 2 Segment 1: schema
-- Phase-2 tables fully designed. Tables owned by later phases exist as
-- minimal FK-bearing stubs and are marked with TODO comments.

-- =============================================================================
-- Extensions
-- =============================================================================

create extension if not exists "pgcrypto";  -- gen_random_uuid()
create extension if not exists "pg_trgm";   -- trigram search on event titles

-- =============================================================================
-- Enums
-- =============================================================================

create type event_type as enum ('concert', 'sport', 'theater', 'festival', 'other');

create type listing_status as enum (
  'draft',
  'verified_ready',
  'active',
  'reserved',
  'sold',
  'removed',
  'expired'
);

create type transaction_status as enum (
  'initiated',
  'payment_pending',
  'payment_authorized',
  'escrow_held',
  'transfer_pending',
  'transfer_in_progress',
  'transfer_completed',
  'payout_pending',
  'completed'
);

create type transfer_status as enum (
  'pending',
  'initiated',
  'provider_processing',
  'completed',
  'failed'
);

-- =============================================================================
-- Shared trigger: bump updated_at on row update
-- =============================================================================

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- =============================================================================
-- profiles — extends auth.users
-- =============================================================================

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  phone text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function set_updated_at();

-- =============================================================================
-- providers
-- =============================================================================

create table public.providers (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  display_name text not null,
  is_active boolean not null default true,
  supports_fast_verification boolean not null default false,
  created_at timestamptz not null default now()
);

-- =============================================================================
-- events
-- =============================================================================

create table public.events (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.providers(id) on delete restrict,
  external_event_id text not null,
  title text not null,
  event_type event_type not null,
  venue_name text not null,
  city text not null,
  country text not null default 'IL',
  starts_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (provider_id, external_event_id)
);

create index events_starts_at_idx on public.events (starts_at);
create index events_city_type_starts_idx on public.events (city, event_type, starts_at);
create index events_title_trgm_idx on public.events using gin (title gin_trgm_ops);

-- =============================================================================
-- tickets
-- =============================================================================

create table public.tickets (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.providers(id) on delete restrict,
  event_id uuid not null references public.events(id) on delete restrict,
  holder_user_id uuid not null references auth.users(id) on delete cascade,
  external_ticket_id text not null,
  section text,
  "row" text,
  seat text,
  face_value_agorot bigint not null check (face_value_agorot >= 0),
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider_id, external_ticket_id)
);

create index tickets_holder_idx on public.tickets (holder_user_id);
create index tickets_event_idx on public.tickets (event_id);

create trigger tickets_set_updated_at
before update on public.tickets
for each row execute function set_updated_at();

-- face_value_agorot is immutable per CLAUDE.md ("Face value is immutable —
-- cannot be edited by seller").
create or replace function tickets_block_face_value_change()
returns trigger
language plpgsql
as $$
begin
  if new.face_value_agorot is distinct from old.face_value_agorot then
    raise exception 'face_value_agorot is immutable';
  end if;
  return new;
end;
$$;

create trigger tickets_face_value_immutable
before update on public.tickets
for each row execute function tickets_block_face_value_change();

-- =============================================================================
-- listings
-- =============================================================================

create table public.listings (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null unique references public.tickets(id) on delete restrict,
  seller_user_id uuid not null references auth.users(id) on delete restrict,
  status listing_status not null default 'draft',
  asking_price_agorot bigint not null check (asking_price_agorot > 0),
  description text,
  published_at timestamptz,
  expires_at timestamptz,
  reserved_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index listings_status_published_idx
  on public.listings (status, published_at desc);
create index listings_seller_idx on public.listings (seller_user_id);
create index listings_expires_idx on public.listings (expires_at);

create trigger listings_set_updated_at
before update on public.listings
for each row execute function set_updated_at();

-- =============================================================================
-- Stub tables (FKs only) — fleshed out in their owning phase
-- =============================================================================

-- TODO Phase 4: full transaction model (amounts, fees, party metadata, audit)
create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete restrict,
  buyer_user_id uuid not null references auth.users(id) on delete restrict,
  seller_user_id uuid not null references auth.users(id) on delete restrict,
  status transaction_status not null default 'initiated',
  created_at timestamptz not null default now()
);

-- TODO Phase 4: payment provider details, amounts, status, error tracking
create table public.payment_records (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references public.transactions(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- TODO Phase 4: held amount, release/refund timestamps, audit
create table public.escrow_records (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references public.transactions(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- TODO Phase 4/5: provider transfer ids, attempts, error payloads
create table public.transfer_records (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references public.transactions(id) on delete cascade,
  status transfer_status not null default 'pending',
  created_at timestamptz not null default now()
);

-- TODO Phase 6: notification kinds, channels, read state, payloads
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- TODO Phase 6: case categories, status, assignee, message thread
create table public.support_cases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  transaction_id uuid references public.transactions(id) on delete set null,
  created_at timestamptz not null default now()
);

-- TODO Phase 5: provider auth tokens (encrypted), expirations, scope
create table public.provider_auth_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider_id uuid not null references public.providers(id) on delete restrict,
  created_at timestamptz not null default now()
);
