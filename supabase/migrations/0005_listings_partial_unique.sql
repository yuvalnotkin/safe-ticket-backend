-- Safe Ticket — Phase 3 Segment 2: listings.ticket_id partial unique index
-- The Phase-1 schema declared `listings.ticket_id` as `not null unique`. The
-- dispatcher's `already_listed_on_safe_ticket` check filters by `status !=
-- 'removed'`, intending that a removed listing's ticket can be re-listed.
-- A column-level UNIQUE blocks that. Replace it with a partial unique index
-- so only non-terminal-removed/expired listings need to be unique by ticket.

alter table public.listings drop constraint listings_ticket_id_key;

create unique index listings_active_ticket_uniq
  on public.listings (ticket_id)
  where status not in ('removed', 'expired');

comment on index public.listings_active_ticket_uniq is
  'Partial unique index — one non-terminal listing per ticket. Re-listing '
  'after soft-delete (status=removed) or expiry (status=expired) inserts a '
  'new row alongside the historical one.';
