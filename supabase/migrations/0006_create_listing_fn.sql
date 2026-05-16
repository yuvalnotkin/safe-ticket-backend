-- Safe Ticket — Phase 3 Segment 2: atomic create-listing RPC
-- Called by POST /api/sell/create-listing (service-role only). Runs the
-- event upsert + ticket upsert + listing insert inside the function's
-- implicit transaction so a partial failure (e.g., the listings partial
-- unique index blocks the INSERT) rolls back the event/ticket writes too.

-- Drop first so signature changes during dev don't choke on
-- "cannot change return type of existing function". On a fresh db reset,
-- the function doesn't exist and the IF EXISTS guard makes this a no-op.
drop function if exists public.create_listing_from_connector(
  uuid, text, text, text, text, text, text, text, timestamptz,
  text, text, text, text, bigint
);

create or replace function public.create_listing_from_connector(
  p_user_id            uuid,
  p_provider_slug      text,
  p_external_event_id  text,
  p_event_title        text,
  p_event_type         text,
  p_event_venue_name   text,
  p_event_city         text,
  p_event_country      text,
  p_event_starts_at    timestamptz,
  p_external_ticket_id text,
  p_section            text,
  p_row                text,
  p_seat               text,
  p_face_value_agorot  bigint
) returns table (
  out_listing_id          uuid,
  out_listing_created_at  timestamptz,
  out_event_id            uuid,
  out_ticket_id           uuid,
  out_face_value_agorot   bigint
)
language plpgsql
as $$
declare
  v_provider_id      uuid;
  v_event_id         uuid;
  v_ticket_id        uuid;
  v_face_value       bigint;
  v_listing_id       uuid;
  v_listing_created  timestamptz;
begin
  select id into v_provider_id
  from public.providers
  where slug = p_provider_slug;
  if v_provider_id is null then
    raise exception 'unknown_provider_slug: %', p_provider_slug;
  end if;

  -- Event: first-write wins for metadata. If a row already exists for
  -- (provider_id, external_event_id), leave its title/venue/etc. alone.
  insert into public.events (
    provider_id, external_event_id, title, event_type,
    venue_name, city, country, starts_at
  )
  values (
    v_provider_id, p_external_event_id, p_event_title, p_event_type::event_type,
    p_event_venue_name, p_event_city, p_event_country, p_event_starts_at
  )
  on conflict (provider_id, external_event_id) do nothing
  returning id into v_event_id;
  if v_event_id is null then
    select id into v_event_id
    from public.events
    where provider_id = v_provider_id
      and external_event_id = p_external_event_id;
  end if;

  -- Ticket: insert-or-update. face_value_agorot is intentionally NOT in the
  -- UPDATE SET — the column is immutable per a BEFORE-UPDATE trigger. If a
  -- prior tickets row exists, its original face value sticks; the seller
  -- gets the prior row's holder_user_id + section/row/seat refreshed and
  -- verified_at bumped.
  insert into public.tickets (
    provider_id, event_id, holder_user_id, external_ticket_id,
    section, "row", seat, face_value_agorot, verified_at
  )
  values (
    v_provider_id, v_event_id, p_user_id, p_external_ticket_id,
    p_section, p_row, p_seat, p_face_value_agorot, now()
  )
  on conflict (provider_id, external_ticket_id) do update
    set holder_user_id = excluded.holder_user_id,
        event_id       = excluded.event_id,
        section        = excluded.section,
        "row"          = excluded."row",
        seat           = excluded.seat,
        verified_at    = excluded.verified_at
  returning id, face_value_agorot into v_ticket_id, v_face_value;

  -- Listing: asking_price_agorot is always = tickets.face_value_agorot
  -- (immutable face-value rule). The partial unique index on listings
  -- (where status not in ('removed','expired')) will reject a second
  -- non-terminal row for the same ticket_id and propagate failure out of
  -- this function, rolling back the event/ticket writes above.
  insert into public.listings (
    ticket_id, seller_user_id, status, asking_price_agorot, published_at
  )
  values (
    v_ticket_id, p_user_id, 'active', v_face_value, now()
  )
  returning id, created_at into v_listing_id, v_listing_created;

  return query
    select v_listing_id, v_listing_created, v_event_id, v_ticket_id, v_face_value;
end;
$$;

comment on function public.create_listing_from_connector(
  uuid, text, text, text, text, text, text, text, timestamptz,
  text, text, text, text, bigint
) is
  'Atomic Phase-3 create-listing path. Called by service-role from '
  'POST /api/sell/create-listing after connector eligibility checks.';
