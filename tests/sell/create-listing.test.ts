import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import request from 'supertest';
import { app } from '../helpers';
import { loginAs, LoginResult } from '../auth-helpers';
import { supabaseAdmin } from '../../src/utils/supabase';
import { calculateServiceFeeAgorot } from '../../src/utils/fees';

let aviv: LoginResult;
let noa: LoginResult;
let avivProviderRowId: string;

const TARGET = 'MOCK-EV-A-1001'; // Aviv, eventim_il, eligible, faceValue 18000

beforeAll(async () => {
  aviv = await loginAs('aviv.cohen@example.com', 'password');
  noa = await loginAs('noa.levi@example.com', 'password');
  const { data } = await supabaseAdmin
    .from('providers')
    .select('id')
    .eq('slug', 'eventim_il')
    .single();
  avivProviderRowId = data!.id as string;
});

afterEach(async () => {
  // Wipe rows added by tests, scoped by MOCK-* identifiers so we don't touch
  // the Phase-2 TKT-* seed data.
  await supabaseAdmin
    .from('listings')
    .delete()
    .in('ticket_id', (
      await supabaseAdmin
        .from('tickets')
        .select('id')
        .like('external_ticket_id', 'MOCK-%')
    ).data?.map(t => t.id as string) ?? []);
  await supabaseAdmin.from('tickets').delete().like('external_ticket_id', 'MOCK-%');
  await supabaseAdmin.from('events').delete().like('external_event_id', 'MOCK-%');
  await supabaseAdmin
    .from('provider_sessions')
    .delete()
    .in('user_id', [aviv.userId, noa.userId]);
});

const completeAuth = async (user: LoginResult, provider: string) => {
  const start = await request(app)
    .post('/api/sell/start-auth')
    .set('Authorization', `Bearer ${user.token}`)
    .send({ provider });
  await request(app)
    .post('/api/sell/callback')
    .set('Authorization', `Bearer ${user.token}`)
    .send({ provider, code: 'mock', state: start.body.state });
};

const createListing = (user: LoginResult, body: object) =>
  request(app)
    .post('/api/sell/create-listing')
    .set('Authorization', `Bearer ${user.token}`)
    .send(body);

describe('POST /api/sell/create-listing', () => {
  it('201 happy path — returns full Listing object, persists events+tickets+listings rows', async () => {
    await completeAuth(aviv, 'eventim_il');

    const res = await createListing(aviv, {
      provider: 'eventim_il',
      providerTicketId: TARGET,
    });

    expect(res.status).toBe(201);
    expect(typeof res.body.id).toBe('string');
    expect(res.body.status).toBe('active');
    expect(res.body.event.name).toBe('Maccabi TA vs Hapoel TA');
    expect(typeof res.body.event.date).toBe('string');
    expect(res.body.event.venue).toBe('Bloomfield Stadium');
    expect(res.body.event.city).toBe('Tel Aviv');
    expect(res.body.event.category).toBe('sports');
    expect(res.body.seat.section).toBe('East');
    expect(res.body.price.faceValueAgorot).toBe(18000);
    expect(res.body.price.serviceFeeAgorot).toBe(calculateServiceFeeAgorot(18000));
    expect(res.body.provider).toBe('eventim_il');
    expect(typeof res.body.createdAt).toBe('string');

    // Connector-internal fields must NOT leak
    expect(res.body.event.externalEventId).toBeUndefined();
    expect(res.body.event.eventType).toBeUndefined();

    // DB state
    const { data: listingRow } = await supabaseAdmin
      .from('listings')
      .select('id, status, published_at, asking_price_agorot, seller_user_id, ticket_id')
      .eq('id', res.body.id)
      .single();
    expect(listingRow!.status).toBe('active');
    expect(listingRow!.published_at).toBeTruthy();
    expect(listingRow!.asking_price_agorot).toBe(18000);
    expect(listingRow!.seller_user_id).toBe(aviv.userId);

    const { data: ticketRow } = await supabaseAdmin
      .from('tickets')
      .select('id, external_ticket_id, holder_user_id, face_value_agorot, verified_at, event_id')
      .eq('id', listingRow!.ticket_id)
      .single();
    expect(ticketRow!.external_ticket_id).toBe(TARGET);
    expect(ticketRow!.holder_user_id).toBe(aviv.userId);
    expect(ticketRow!.face_value_agorot).toBe(18000);
    expect(ticketRow!.verified_at).toBeTruthy();

    const { data: eventRow } = await supabaseAdmin
      .from('events')
      .select('external_event_id, title, event_type, venue_name, city, country')
      .eq('id', ticketRow!.event_id)
      .single();
    expect(eventRow!.external_event_id).toBe('MOCK-EVT-EV-1');
    expect(eventRow!.event_type).toBe('sport');
    expect(eventRow!.country).toBe('IL');
  });

  it('the created listing appears in GET /api/listings search results', async () => {
    await completeAuth(aviv, 'eventim_il');
    const create = await createListing(aviv, {
      provider: 'eventim_il',
      providerTicketId: TARGET,
    });
    expect(create.status).toBe(201);

    const search = await request(app).get('/api/listings').query({ q: 'Maccabi TA vs Hapoel' });
    expect(search.status).toBe(200);
    const ids: string[] = search.body.items.map((i: any) => i.id);
    expect(ids).toContain(create.body.id);
  });

  it('after create-listing, the same providerTicketId returns eligible:false / already_listed_on_safe_ticket on GET /api/sell/tickets', async () => {
    await completeAuth(aviv, 'eventim_il');
    await createListing(aviv, { provider: 'eventim_il', providerTicketId: TARGET });

    const tickets = await request(app)
      .get('/api/sell/tickets')
      .query({ provider: 'eventim_il' })
      .set('Authorization', `Bearer ${aviv.token}`);

    const target = tickets.body.items.find((t: any) => t.providerTicketId === TARGET);
    expect(target.eligible).toBe(false);
    expect(target.ineligibleReason).toBe('already_listed_on_safe_ticket');
  });

  it('re-list after soft-remove: create → flip listing to removed → create again → second listing is active, first still removed, ticket reused', async () => {
    await completeAuth(aviv, 'eventim_il');

    const first = await createListing(aviv, {
      provider: 'eventim_il',
      providerTicketId: TARGET,
    });
    expect(first.status).toBe(201);

    // Soft-delete: S3 will add the DELETE endpoint, we flip manually here.
    await supabaseAdmin
      .from('listings')
      .update({ status: 'removed' })
      .eq('id', first.body.id);

    const { data: ticketBefore } = await supabaseAdmin
      .from('tickets')
      .select('id, verified_at')
      .eq('external_ticket_id', TARGET)
      .eq('provider_id', avivProviderRowId)
      .single();

    await new Promise((r) => setTimeout(r, 25));

    const second = await createListing(aviv, {
      provider: 'eventim_il',
      providerTicketId: TARGET,
    });
    expect(second.status).toBe(201);
    expect(second.body.id).not.toBe(first.body.id);

    // Both rows persist, statuses correct
    const { data: allListings } = await supabaseAdmin
      .from('listings')
      .select('id, status')
      .in('id', [first.body.id, second.body.id]);
    const byId = Object.fromEntries(allListings!.map(r => [r.id, r.status]));
    expect(byId[first.body.id]).toBe('removed');
    expect(byId[second.body.id]).toBe('active');

    // Same tickets row, verified_at bumped
    const { data: ticketsAll } = await supabaseAdmin
      .from('tickets')
      .select('id, verified_at')
      .eq('external_ticket_id', TARGET)
      .eq('provider_id', avivProviderRowId);
    expect(ticketsAll!.length).toBe(1);
    expect(ticketsAll![0].id).toBe(ticketBefore!.id);
    expect(new Date(ticketsAll![0].verified_at).getTime()).toBeGreaterThan(
      new Date(ticketBefore!.verified_at).getTime(),
    );
  });

  it('atomicity: when the listing INSERT cannot proceed (a non-removed listing already exists for the same providerTicketId), no orphan tickets row is left behind', async () => {
    // Pre-create the conflicting state under a different seller, then have
    // Aviv attempt to list the same providerTicketId. The dispatcher's
    // already_listed override returns 409 before the RPC runs — confirming
    // the transaction never spawns orphan rows.
    const { data: eventRow } = await supabaseAdmin
      .from('events')
      .insert({
        provider_id: avivProviderRowId,
        external_event_id: 'MOCK-EVT-EV-PRE',
        title: 'placeholder',
        event_type: 'sport',
        venue_name: 'X',
        city: 'X',
        starts_at: new Date(Date.now() + 86_400_000).toISOString(),
      })
      .select('id')
      .single();
    const { data: preTicket } = await supabaseAdmin
      .from('tickets')
      .insert({
        provider_id: avivProviderRowId,
        event_id: eventRow!.id,
        holder_user_id: noa.userId,
        external_ticket_id: TARGET,
        section: 'East',
        row: '14',
        seat: '22',
        face_value_agorot: 18000,
      })
      .select('id')
      .single();
    const { data: preListing } = await supabaseAdmin
      .from('listings')
      .insert({
        ticket_id: preTicket!.id,
        seller_user_id: noa.userId,
        status: 'active',
        asking_price_agorot: 18000,
      })
      .select('id')
      .single();

    await completeAuth(aviv, 'eventim_il');

    const res = await createListing(aviv, {
      provider: 'eventim_il',
      providerTicketId: TARGET,
    });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('already_listed');

    // No additional listings created beyond the pre-existing one
    const { data: allListings } = await supabaseAdmin
      .from('listings')
      .select('id')
      .eq('ticket_id', preTicket!.id);
    expect(allListings!.length).toBe(1);
    expect(allListings![0].id).toBe(preListing!.id);

    // The pre-existing tickets row is unchanged (still owned by Noa)
    const { data: ticketsAll } = await supabaseAdmin
      .from('tickets')
      .select('id, holder_user_id')
      .eq('external_ticket_id', TARGET)
      .eq('provider_id', avivProviderRowId);
    expect(ticketsAll!.length).toBe(1);
    expect(ticketsAll![0].holder_user_id).toBe(noa.userId);
  });

  it('409 no_provider_session when the user has no callback completed', async () => {
    const res = await createListing(aviv, {
      provider: 'eventim_il',
      providerTicketId: TARGET,
    });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('no_provider_session');
  });

  it('409 ticket_not_eligible with reason=ownership_mismatch when the ticket is not in the caller inventory', async () => {
    await completeAuth(aviv, 'eventim_il');
    const res = await createListing(aviv, {
      provider: 'eventim_il',
      providerTicketId: 'MOCK-EV-DOES-NOT-EXIST',
    });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('ticket_not_eligible');
    expect(res.body.error.details?.reason).toBe('ownership_mismatch');
  });

  it('409 ticket_not_eligible with the fixture reason for an ineligible ticket (non_transferable)', async () => {
    await completeAuth(aviv, 'eventim_il');
    const res = await createListing(aviv, {
      provider: 'eventim_il',
      providerTicketId: 'MOCK-EV-A-1003', // non_transferable in fixture
    });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('ticket_not_eligible');
    expect(res.body.error.details?.reason).toBe('non_transferable');
  });

  it('409 ticket_not_eligible with reason=event_passed for a past-event fixture', async () => {
    await completeAuth(aviv, 'leaan');
    const res = await createListing(aviv, {
      provider: 'leaan',
      providerTicketId: 'MOCK-LN-A-2002',
    });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('ticket_not_eligible');
    expect(res.body.error.details?.reason).toBe('event_passed');
  });

  it('409 already_listed when the same providerTicketId is created twice in a row', async () => {
    await completeAuth(aviv, 'eventim_il');
    const first = await createListing(aviv, {
      provider: 'eventim_il',
      providerTicketId: TARGET,
    });
    expect(first.status).toBe(201);

    const second = await createListing(aviv, {
      provider: 'eventim_il',
      providerTicketId: TARGET,
    });
    expect(second.status).toBe(409);
    expect(second.body.error.code).toBe('already_listed');
  });

  it('400 invalid_request when provider is unknown', async () => {
    await completeAuth(aviv, 'eventim_il');
    const res = await createListing(aviv, {
      provider: 'ticketmaster',
      providerTicketId: TARGET,
    });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('invalid_request');
  });

  it('400 invalid_request when providerTicketId is missing', async () => {
    const res = await createListing(aviv, { provider: 'eventim_il' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('invalid_request');
  });

  it('400 invalid_request when the body carries faceValueAgorot (seller cannot set price)', async () => {
    const res = await createListing(aviv, {
      provider: 'eventim_il',
      providerTicketId: TARGET,
      faceValueAgorot: 1,
    });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('invalid_request');
  });

  it('400 invalid_request when the body carries asking_price (strict body)', async () => {
    const res = await createListing(aviv, {
      provider: 'eventim_il',
      providerTicketId: TARGET,
      asking_price: 1,
    });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('invalid_request');
  });

  it('401 unauthorized without token', async () => {
    const res = await request(app)
      .post('/api/sell/create-listing')
      .send({ provider: 'eventim_il', providerTicketId: TARGET });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('unauthorized');
  });
});
