-- Safe Ticket — Phase 2 Segment 1: demo seed data
-- Idempotent. Safe to re-run; `supabase db reset` runs this after migrations.
-- Money values are in agorot (1 ILS = 100 agorot). All times are UTC.

-- =============================================================================
-- Seed users (Supabase auth.users + auth.identities)
-- Password for both users is "password". Local-dev only.
-- =============================================================================

-- Aviv Cohen
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_super_admin,
  confirmation_token, recovery_token, email_change_token_new, email_change
)
values (
  '00000000-0000-0000-0000-000000000000',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'authenticated', 'authenticated',
  'aviv.cohen@example.com',
  crypt('password', gen_salt('bf')),
  now(), now(), now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{}'::jsonb,
  false, '', '', '', ''
)
on conflict (id) do nothing;

insert into auth.identities (
  id, user_id, identity_data, provider, provider_id,
  last_sign_in_at, created_at, updated_at
)
values (
  gen_random_uuid(),
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  jsonb_build_object(
    'sub', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::text,
    'email', 'aviv.cohen@example.com'
  ),
  'email',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  now(), now(), now()
)
on conflict (provider, provider_id) do nothing;

-- Noa Levi
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_super_admin,
  confirmation_token, recovery_token, email_change_token_new, email_change
)
values (
  '00000000-0000-0000-0000-000000000000',
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  'authenticated', 'authenticated',
  'noa.levi@example.com',
  crypt('password', gen_salt('bf')),
  now(), now(), now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{}'::jsonb,
  false, '', '', '', ''
)
on conflict (id) do nothing;

insert into auth.identities (
  id, user_id, identity_data, provider, provider_id,
  last_sign_in_at, created_at, updated_at
)
values (
  gen_random_uuid(),
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  jsonb_build_object(
    'sub', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::text,
    'email', 'noa.levi@example.com'
  ),
  'email',
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  now(), now(), now()
)
on conflict (provider, provider_id) do nothing;

-- =============================================================================
-- profiles
-- =============================================================================

insert into public.profiles (id, display_name, phone)
values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Aviv Cohen', '+972-50-1234567'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Noa Levi',   '+972-52-7654321')
on conflict (id) do nothing;

-- =============================================================================
-- providers
-- =============================================================================

insert into public.providers (slug, display_name, supports_fast_verification)
values
  ('leaan',      'Leaan',           true),
  ('eventim_il', 'Eventim Israel',  true),
  ('hala',       'Hala',            false),
  ('tmura',      'Tmura',           false)
on conflict (slug) do nothing;

-- =============================================================================
-- events — 12 future events spread across providers/cities/types
-- =============================================================================

insert into public.events (provider_id, external_event_id, title, event_type, venue_name, city, starts_at)
select p.id, v.external_event_id, v.title, v.event_type::event_type, v.venue_name, v.city, v.starts_at
from (values
  ('leaan',      'LN-001', 'Idan Raichel Live',                     'concert',  'Hayarkon Park',           'Tel Aviv',  '2026-05-14 19:00:00+00'::timestamptz),
  ('leaan',      'LN-002', 'Static & Ben El',                       'concert',  'Menora Mivtachim Arena',  'Tel Aviv',  '2026-06-02 20:30:00+00'::timestamptz),
  ('leaan',      'LN-003', 'Shlomo Artzi at Caesarea',              'concert',  'Caesarea Amphitheatre',   'Caesarea',  '2026-07-18 20:00:00+00'::timestamptz),
  ('eventim_il', 'EV-101', 'Maccabi TA vs Hapoel TA',               'sport',    'Bloomfield Stadium',      'Tel Aviv',  '2026-05-09 18:30:00+00'::timestamptz),
  ('eventim_il', 'EV-102', 'Beitar Jerusalem vs Maccabi Haifa',     'sport',    'Teddy Stadium',           'Jerusalem', '2026-05-23 19:00:00+00'::timestamptz),
  ('eventim_il', 'EV-103', 'Maccabi TA vs Olympiacos (EuroLeague)', 'sport',    'Menora Mivtachim Arena',  'Tel Aviv',  '2026-05-30 20:00:00+00'::timestamptz),
  ('hala',       'HL-201', 'Hamlet',                                'theater',  'Habima Theatre',          'Tel Aviv',  '2026-06-12 20:00:00+00'::timestamptz),
  ('hala',       'HL-202', 'The Cherry Orchard',                    'theater',  'Jerusalem Theatre',       'Jerusalem', '2026-06-20 19:30:00+00'::timestamptz),
  ('tmura',      'TM-301', 'Red Sea Jazz Festival — Opening Night', 'festival', 'Eilat Port',              'Eilat',     '2026-08-25 21:00:00+00'::timestamptz),
  ('tmura',      'TM-302', 'Tel Aviv Pride Concert',                'festival', 'Park HaYarkon',           'Tel Aviv',  '2026-06-13 18:00:00+00'::timestamptz),
  ('eventim_il', 'EV-104', 'Israel Philharmonic Orchestra',         'concert',  'Haifa Auditorium',        'Haifa',     '2026-09-04 20:00:00+00'::timestamptz),
  ('hala',       'HL-203', 'Tech Conference 2026',                  'other',   'Expo Tel Aviv',           'Tel Aviv',  '2026-10-08 09:00:00+00'::timestamptz)
) as v(provider_slug, external_event_id, title, event_type, venue_name, city, starts_at)
join public.providers p on p.slug = v.provider_slug
on conflict (provider_id, external_event_id) do nothing;

-- =============================================================================
-- tickets — 30 across the 2 seed users, distributed over the 12 events
-- =============================================================================

insert into public.tickets (
  provider_id, event_id, holder_user_id, external_ticket_id,
  section, "row", seat, face_value_agorot, verified_at
)
select
  e.provider_id,
  e.id,
  t.holder_user_id::uuid,
  t.external_ticket_id,
  t.section, t."row", t.seat,
  t.face_value_agorot,
  case when t.verified then now() else null end
from (values
  -- Aviv Cohen tickets
  ('LN-001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'TKT-LN-001-A1', 'GA',     null,  null,  35000,  true),
  ('LN-001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'TKT-LN-001-A2', 'GA',     null,  null,  35000,  true),
  ('LN-002', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'TKT-LN-002-A1', 'A',      '5',   '12',  42000,  true),
  ('LN-002', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'TKT-LN-002-A2', 'A',      '5',   '13',  42000,  true),
  ('LN-003', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'TKT-LN-003-A1', 'B',      '10',  '4',   38000,  true),
  ('EV-101', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'TKT-EV-101-A1', 'East',   '14',  '22',  18000,  true),
  ('EV-101', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'TKT-EV-101-A2', 'East',   '14',  '23',  18000,  true),
  ('EV-103', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'TKT-EV-103-A1', 'Lower',  'C',   '18',  55000,  true),
  ('HL-201', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'TKT-HL-201-A1', 'Stalls', '7',   '14',  28000,  true),
  ('HL-202', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'TKT-HL-202-A1', 'Mezz',   '3',   '8',   24000,  false),
  ('TM-301', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'TKT-TM-301-A1', 'GA',     null,  null,  45000,  true),
  ('TM-302', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'TKT-TM-302-A1', 'GA',     null,  null,  19000,  true),
  ('EV-104', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'TKT-EV-104-A1', 'Stalls', '12',  '20',  32000,  true),
  ('HL-203', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'TKT-HL-203-A1', 'Standard', null,  null, 89000, true),
  ('LN-002', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'TKT-LN-002-A3', 'B',      '7',   '4',   38000,  true),
  -- Noa Levi tickets
  ('LN-001', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'TKT-LN-001-B1', 'GA',     null,  null,  35000,  true),
  ('LN-003', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'TKT-LN-003-B1', 'A',      '3',   '15',  48000,  true),
  ('LN-003', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'TKT-LN-003-B2', 'A',      '3',   '16',  48000,  true),
  ('EV-101', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'TKT-EV-101-B1', 'West',   '8',   '5',   22000,  true),
  ('EV-102', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'TKT-EV-102-B1', 'North',  '20',  '11',  16000,  true),
  ('EV-102', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'TKT-EV-102-B2', 'North',  '20',  '12',  16000,  true),
  ('EV-103', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'TKT-EV-103-B1', 'Upper',  'M',   '9',   34000,  true),
  ('EV-103', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'TKT-EV-103-B2', 'Upper',  'M',   '10',  34000,  true),
  ('HL-201', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'TKT-HL-201-B1', 'Mezz',   '2',   '6',   22000,  true),
  ('HL-202', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'TKT-HL-202-B1', 'Stalls', '9',   '11',  28000,  true),
  ('TM-301', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'TKT-TM-301-B1', 'VIP',    null,  null,  88000,  true),
  ('TM-302', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'TKT-TM-302-B1', 'GA',     null,  null,  19000,  true),
  ('TM-302', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'TKT-TM-302-B2', 'GA',     null,  null,  19000,  false),
  ('EV-104', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'TKT-EV-104-B1', 'Balcony','4',   '7',   24000,  true),
  ('LN-002', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'TKT-LN-002-B1', 'C',      '12',  '21',  32000,  true)
) as t(external_event_id, holder_user_id, external_ticket_id, section, "row", seat, face_value_agorot, verified)
join public.events e on e.external_event_id = t.external_event_id
on conflict (provider_id, external_ticket_id) do nothing;

-- =============================================================================
-- listings — most active, plus a handful of draft / sold / expired for variety
-- =============================================================================

insert into public.listings (
  ticket_id, seller_user_id, status, asking_price_agorot,
  description, published_at, expires_at
)
select
  t.id,
  t.holder_user_id,
  l.status::listing_status,
  l.asking_price_agorot,
  l.description,
  case when l.status in ('active', 'sold', 'expired')
       then now() - (l.days_ago || ' days')::interval
       else null
  end,
  case
    when l.status = 'expired' then now() - interval '1 day'
    when l.status = 'active'  then now() + interval '14 days'
    else null
  end
from (values
  -- Aviv's listings
  ('TKT-LN-001-A1', 'active',  40000,  'Great spot near the stage',                 3),
  ('TKT-LN-001-A2', 'active',  40000,  'Pair with TKT-LN-001-A1',                   3),
  ('TKT-LN-002-A1', 'active',  48000,  'Section A, side-by-side seats available',   2),
  ('TKT-LN-002-A2', 'active',  48000,  null,                                        2),
  ('TKT-LN-003-A1', 'active',  42000,  'Caesarea, summer night — beautiful venue',  5),
  ('TKT-EV-101-A1', 'active',  20000,  'Derby! East stand',                         1),
  ('TKT-EV-101-A2', 'active',  20000,  'Pair with -A1',                             1),
  ('TKT-EV-103-A1', 'active',  62000,  'Lower bowl, EuroLeague playoff vibe',       4),
  ('TKT-HL-201-A1', 'active',  30000,  'Habima — opening week',                     6),
  ('TKT-TM-301-A1', 'active',  50000,  'Red Sea Jazz, opening night',              10),
  ('TKT-TM-302-A1', 'active',  20000,  'Tel Aviv Pride',                            2),
  ('TKT-EV-104-A1', 'active',  35000,  null,                                        7),
  ('TKT-HL-203-A1', 'active',  92000,  'Single Tech Conf pass',                     8),
  ('TKT-LN-002-A3', 'draft',   38000,  'Still deciding on price',                   0),
  ('TKT-HL-202-A1', 'expired', 26000,  'Listing window closed',                    35),
  -- Noa's listings
  ('TKT-LN-001-B1', 'active',  39000,  null,                                        2),
  ('TKT-LN-003-B1', 'active',  52000,  'Section A, row 3 — premium',                3),
  ('TKT-LN-003-B2', 'active',  52000,  'Pair with -B1',                             3),
  ('TKT-EV-101-B1', 'active',  24000,  'West stand, single',                        1),
  ('TKT-EV-102-B1', 'active',  18000,  'Beitar home game',                          4),
  ('TKT-EV-102-B2', 'active',  18000,  'Pair with -B1',                             4),
  ('TKT-EV-103-B1', 'active',  38000,  'Upper bowl pair available',                 5),
  ('TKT-EV-103-B2', 'active',  38000,  null,                                        5),
  ('TKT-HL-201-B1', 'active',  26000,  null,                                        6),
  ('TKT-HL-202-B1', 'active',  31000,  'Cherry Orchard, stalls',                    8),
  ('TKT-TM-301-B1', 'active',  95000,  'VIP — close-up tables',                    11),
  ('TKT-TM-302-B1', 'active',  21000,  null,                                        2),
  ('TKT-EV-104-B1', 'active',  26000,  'Balcony seat',                              7),
  ('TKT-LN-002-B1', 'sold',    36000,  'Sold last week',                           14),
  ('TKT-TM-302-B2', 'draft',   22000,  'Waiting on verification',                   0)
) as l(external_ticket_id, status, asking_price_agorot, description, days_ago)
join public.tickets t on t.external_ticket_id = l.external_ticket_id
on conflict (ticket_id) do nothing;
