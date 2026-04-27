-- Safe Ticket — Phase 2 Segment 1: RLS policies
-- One artifact for the entire policy surface so it's reviewable as a unit.
-- Service role bypasses RLS by design (used by trusted server code).

-- =============================================================================
-- Enable RLS on every table
-- =============================================================================

alter table public.profiles                enable row level security;
alter table public.providers               enable row level security;
alter table public.events                  enable row level security;
alter table public.tickets                 enable row level security;
alter table public.listings                enable row level security;
alter table public.transactions            enable row level security;
alter table public.payment_records         enable row level security;
alter table public.escrow_records          enable row level security;
alter table public.transfer_records        enable row level security;
alter table public.notifications           enable row level security;
alter table public.support_cases           enable row level security;
alter table public.provider_auth_sessions  enable row level security;

-- =============================================================================
-- profiles — own row only, read & write
-- =============================================================================

create policy profiles_select_own
  on public.profiles for select
  to authenticated
  using (id = (select auth.uid()));

create policy profiles_insert_own
  on public.profiles for insert
  to authenticated
  with check (id = (select auth.uid()));

create policy profiles_update_own
  on public.profiles for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- =============================================================================
-- providers — public read, writes via service role only
-- =============================================================================

create policy providers_select_public
  on public.providers for select
  to anon, authenticated
  using (true);

-- =============================================================================
-- events — public read, writes via service role only
-- =============================================================================

create policy events_select_public
  on public.events for select
  to anon, authenticated
  using (true);

-- =============================================================================
-- tickets — only the holder sees / mutates their tickets
-- =============================================================================

create policy tickets_select_own
  on public.tickets for select
  to authenticated
  using (holder_user_id = (select auth.uid()));

create policy tickets_insert_own
  on public.tickets for insert
  to authenticated
  with check (holder_user_id = (select auth.uid()));

create policy tickets_update_own
  on public.tickets for update
  to authenticated
  using (holder_user_id = (select auth.uid()))
  with check (holder_user_id = (select auth.uid()));

create policy tickets_delete_own
  on public.tickets for delete
  to authenticated
  using (holder_user_id = (select auth.uid()));

-- =============================================================================
-- listings — public read for active rows; otherwise seller only
-- =============================================================================

create policy listings_select_active_or_own
  on public.listings for select
  to anon, authenticated
  using (
    status = 'active'
    or seller_user_id = (select auth.uid())
  );

create policy listings_insert_own
  on public.listings for insert
  to authenticated
  with check (seller_user_id = (select auth.uid()));

create policy listings_update_own
  on public.listings for update
  to authenticated
  using (seller_user_id = (select auth.uid()))
  with check (seller_user_id = (select auth.uid()));

create policy listings_delete_own
  on public.listings for delete
  to authenticated
  using (seller_user_id = (select auth.uid()));

-- =============================================================================
-- Stub tables — service role only (no policies = nothing visible to clients)
-- Phase 3/4/5/6 will add appropriate read/write policies when those flows land.
-- =============================================================================

-- transactions, payment_records, escrow_records, transfer_records,
-- notifications, support_cases, provider_auth_sessions: no policies.
