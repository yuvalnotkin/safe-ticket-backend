import { describe, it, expect, beforeAll, afterEach, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../helpers';
import { loginAs, LoginResult } from '../auth-helpers';
import { supabaseAdmin } from '../../src/utils/supabase';

let aviv: LoginResult;
let noa: LoginResult;

beforeAll(async () => {
  aviv = await loginAs('aviv.cohen@example.com', 'password');
  noa = await loginAs('noa.levi@example.com', 'password');
});

afterEach(async () => {
  await supabaseAdmin.from('provider_sessions').delete().in('user_id', [aviv.userId, noa.userId]);
});

const startAuthFor = async (user: LoginResult, provider: string) =>
  request(app)
    .post('/api/sell/start-auth')
    .set('Authorization', `Bearer ${user.token}`)
    .send({ provider });

const callbackFor = async (user: LoginResult, provider: string, state: string) =>
  request(app)
    .post('/api/sell/callback')
    .set('Authorization', `Bearer ${user.token}`)
    .send({ provider, code: 'mock', state });

const completeAuth = async (user: LoginResult, provider: string) => {
  const start = await startAuthFor(user, provider);
  await callbackFor(user, provider, start.body.state);
};

const getTickets = (user: LoginResult, provider: string) =>
  request(app)
    .get('/api/sell/tickets')
    .query({ provider })
    .set('Authorization', `Bearer ${user.token}`);

describe('GET /api/sell/tickets', () => {
  it("200 happy path — returns Aviv's eventim_il fixture inventory in contract shape", async () => {
    await completeAuth(aviv, 'eventim_il');
    const res = await getTickets(aviv, 'eventim_il');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.items)).toBe(true);
    expect(res.body.items.length).toBe(4);

    const t = res.body.items[0];
    expect(typeof t.providerTicketId).toBe('string');
    expect(typeof t.event.name).toBe('string');
    expect(typeof t.event.date).toBe('string');
    expect(typeof t.event.venue).toBe('string');
    expect(typeof t.event.city).toBe('string');
    expect(['sports', 'culture']).toContain(t.event.category);
    // Connector-internal fields must NOT leak into the API response
    expect(t.event.externalEventId).toBeUndefined();
    expect(t.event.eventType).toBeUndefined();
    expect(typeof t.seat.section).toBe('string');
    expect(Number.isInteger(t.faceValueAgorot)).toBe(true);
    expect(typeof t.eligible).toBe('boolean');
    expect('ineligibleReason' in t).toBe(true);
  });

  it("scoped per user — Aviv's session for eventim_il does not surface Noa's inventory and vice versa", async () => {
    await completeAuth(aviv, 'eventim_il');
    await completeAuth(noa, 'eventim_il');

    const avivRes = await getTickets(aviv, 'eventim_il');
    const noaRes = await getTickets(noa, 'eventim_il');

    expect(avivRes.status).toBe(200);
    expect(noaRes.status).toBe(200);
    // Aviv's fixture is 4 tickets on eventim_il, Noa has 0 (fixture-defined).
    expect(avivRes.body.items.length).toBe(4);
    expect(noaRes.body.items.length).toBe(0);
  });

  it('already-listed override: a fixture providerTicketId with an active Safe-Ticket listing returns eligible:false / already_listed_on_safe_ticket', async () => {
    const TARGET = 'MOCK-EV-A-1001';

    // Pick any seeded event for eventim_il (the dispatcher's join only checks
    // provider_id + external_ticket_id, not the ticket's event).
    const { data: providerRow } = await supabaseAdmin
      .from('providers')
      .select('id')
      .eq('slug', 'eventim_il')
      .single();
    const { data: eventRow } = await supabaseAdmin
      .from('events')
      .select('id')
      .eq('provider_id', providerRow!.id)
      .limit(1)
      .single();

    const { data: ticket } = await supabaseAdmin
      .from('tickets')
      .insert({
        provider_id: providerRow!.id,
        event_id: eventRow!.id,
        holder_user_id: aviv.userId,
        external_ticket_id: TARGET,
        section: 'East',
        row: '14',
        seat: '22',
        face_value_agorot: 18000,
      })
      .select('id')
      .single();
    const { data: listing } = await supabaseAdmin
      .from('listings')
      .insert({
        ticket_id: ticket!.id,
        seller_user_id: aviv.userId,
        status: 'active',
        asking_price_agorot: 18000,
      })
      .select('id')
      .single();

    try {
      await completeAuth(aviv, 'eventim_il');
      const res = await getTickets(aviv, 'eventim_il');
      expect(res.status).toBe(200);
      const t = res.body.items.find((x: any) => x.providerTicketId === TARGET);
      expect(t).toBeDefined();
      expect(t.eligible).toBe(false);
      expect(t.ineligibleReason).toBe('already_listed_on_safe_ticket');
    } finally {
      await supabaseAdmin.from('listings').delete().eq('id', listing!.id);
      await supabaseAdmin.from('tickets').delete().eq('id', ticket!.id);
    }
  });

  it('409 no_provider_session when the caller has not completed callback for this provider', async () => {
    const res = await getTickets(aviv, 'eventim_il');
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('no_provider_session');
  });

  it('409 no_provider_session when the stored session has expired', async () => {
    // Complete auth normally, then manually backdate expires_at to the past.
    await completeAuth(aviv, 'eventim_il');
    await supabaseAdmin
      .from('provider_sessions')
      .update({ expires_at: new Date(Date.now() - 60_000).toISOString() })
      .eq('user_id', aviv.userId)
      .eq('provider', 'eventim_il');

    const res = await getTickets(aviv, 'eventim_il');
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('no_provider_session');
  });

  it('400 invalid_request when provider query param is unknown', async () => {
    const res = await request(app)
      .get('/api/sell/tickets')
      .query({ provider: 'ticketmaster' })
      .set('Authorization', `Bearer ${aviv.token}`);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('invalid_request');
  });

  it('400 invalid_request when provider query param is missing', async () => {
    const res = await request(app)
      .get('/api/sell/tickets')
      .set('Authorization', `Bearer ${aviv.token}`);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('invalid_request');
  });

  it('401 unauthorized without token', async () => {
    const res = await request(app).get('/api/sell/tickets').query({ provider: 'eventim_il' });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('unauthorized');
  });
});
