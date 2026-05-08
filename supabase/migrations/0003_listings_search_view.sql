-- Safe Ticket — Phase 2 Segment 3: search view + supporting indexes
-- Adds a flat read-only view over listings ⨝ tickets ⨝ events ⨝ providers
-- for the public search endpoint. Does NOT modify any existing table.

-- Indexes that segment 1 missed but are needed for our filter/sort columns.
create index if not exists events_provider_id_idx
  on public.events (provider_id);

create index if not exists tickets_face_value_idx
  on public.tickets (face_value_agorot);

-- Search view. Queried server-side via the service-role admin client only.
-- Service-role queries bypass RLS, so the public listings endpoint can simply
-- filter `status = 'active'` in code and return matching rows.
--
-- security_invoker = true is set defensively: if a future change ever exposes
-- the view to anon/authenticated callers, the underlying tables' RLS is
-- enforced under the caller's role rather than the view owner's. No GRANT to
-- anon/authenticated is added here — direct PostgREST access is not a
-- supported path for this view.
create or replace view public.listings_search
with (security_invoker = true) as
select
  l.id                                                  as listing_id,
  l.status                                              as status,
  l.created_at                                          as listing_created_at,
  l.published_at                                        as listing_published_at,
  t.id                                                  as ticket_id,
  t.section                                             as section,
  t."row"                                               as row_label,
  t.seat                                                as seat,
  t.face_value_agorot                                   as face_value_agorot,
  (t.face_value_agorot + (t.face_value_agorot / 10))::bigint
                                                        as total_price_agorot,
  e.id                                                  as event_id,
  e.title                                               as event_title,
  e.event_type                                          as event_type,
  e.venue_name                                          as venue_name,
  e.city                                                as city,
  e.starts_at                                           as starts_at,
  p.slug                                                as provider_slug
  -- l.asking_price_agorot is intentionally omitted: per CLAUDE.md, face value
  -- is immutable and the only legitimate price. tickets.face_value_agorot is
  -- the source of truth for both display (faceValueAgorot) and total price.
from public.listings l
join public.tickets   t on t.id = l.ticket_id
join public.events    e on e.id = t.event_id
join public.providers p on p.id = e.provider_id;

comment on view public.listings_search is
  'Flattened, read-only projection of listings/tickets/events/providers used '
  'by GET /api/listings (service-role queries only). total_price_agorot = '
  'face + 10% (integer-truncated, matches Math.floor in TS code).';
