import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { supabaseAdmin } from '../../src/utils/supabase';
import { dispatcher } from '../../src/connectors';
import {
  AVIV_USER_ID,
  mockConnector,
  __resetMockState,
} from '../../src/connectors/mock';
import { NotImplementedInPhase3Error, ProviderSlug } from '../../src/connectors/types';

const completeAuth = async (
  provider: ProviderSlug,
  userId: string,
): Promise<string> => {
  const { state } = await dispatcher.startAuth({ provider, userId });
  const cb = await dispatcher.handleCallback({
    provider,
    code: 'mock-code',
    state,
  });
  return cb.providerUserId;
};

// One of Aviv's fixture providerTicketIds; we'll back this with a real
// tickets+listings row to exercise the dispatcher's already-listed override.
const TARGET_PROVIDER_TICKET_ID = 'MOCK-EV-A-1001';
const TARGET_PROVIDER: ProviderSlug = 'eventim_il';

describe('dispatcher.listTickets — already-listed override', () => {
  let providerRowId: string;
  let eventRowId: string;
  let createdTicketId: string | null = null;
  let createdListingId: string | null = null;

  beforeAll(async () => {
    const { data: providerRow, error: pErr } = await supabaseAdmin
      .from('providers')
      .select('id')
      .eq('slug', TARGET_PROVIDER)
      .single();
    if (pErr || !providerRow) throw new Error(`provider ${TARGET_PROVIDER} not seeded`);
    providerRowId = providerRow.id as string;

    // Any seeded event for this provider works — the dispatcher's check
    // doesn't care about event identity.
    const { data: eventRow, error: eErr } = await supabaseAdmin
      .from('events')
      .select('id')
      .eq('provider_id', providerRowId)
      .limit(1)
      .single();
    if (eErr || !eventRow) throw new Error('no seeded event for eventim_il');
    eventRowId = eventRow.id as string;
  });

  beforeEach(() => {
    __resetMockState();
  });

  afterEach(async () => {
    if (createdListingId) {
      await supabaseAdmin.from('listings').delete().eq('id', createdListingId);
      createdListingId = null;
    }
    if (createdTicketId) {
      await supabaseAdmin.from('tickets').delete().eq('id', createdTicketId);
      createdTicketId = null;
    }
  });

  const insertActiveListing = async (
    externalTicketId: string,
    status: 'active' | 'removed' = 'active',
  ): Promise<void> => {
    const { data: ticket, error: tErr } = await supabaseAdmin
      .from('tickets')
      .insert({
        provider_id: providerRowId,
        event_id: eventRowId,
        holder_user_id: AVIV_USER_ID,
        external_ticket_id: externalTicketId,
        section: 'East',
        row: '14',
        seat: '22',
        face_value_agorot: 18000,
      })
      .select('id')
      .single();
    if (tErr || !ticket) throw new Error(`failed to insert ticket: ${tErr?.message}`);
    createdTicketId = ticket.id as string;

    const { data: listing, error: lErr } = await supabaseAdmin
      .from('listings')
      .insert({
        ticket_id: createdTicketId,
        seller_user_id: AVIV_USER_ID,
        status,
        asking_price_agorot: 18000,
      })
      .select('id')
      .single();
    if (lErr || !listing) throw new Error(`failed to insert listing: ${lErr?.message}`);
    createdListingId = listing.id as string;
  };

  it('downgrades a ticket whose providerTicketId has an active listing in our DB', async () => {
    await insertActiveListing(TARGET_PROVIDER_TICKET_ID, 'active');

    const providerUserId = await completeAuth(TARGET_PROVIDER, AVIV_USER_ID);
    const tickets = await dispatcher.listTickets({
      userId: AVIV_USER_ID,
      providerUserId,
      provider: TARGET_PROVIDER,
    });

    const target = tickets.find(t => t.providerTicketId === TARGET_PROVIDER_TICKET_ID);
    expect(target).toBeDefined();
    expect(target!.eligible).toBe(false);
    expect(target!.ineligibleReason).toBe('already_listed_on_safe_ticket');

    // Other Aviv tickets on eventim_il are unaffected — sibling MOCK-EV-A-1002
    // is eligible in the fixture and has no DB row.
    const sibling = tickets.find(t => t.providerTicketId === 'MOCK-EV-A-1002');
    expect(sibling).toBeDefined();
    expect(sibling!.eligible).toBe(true);
    expect(sibling!.ineligibleReason).toBeNull();
  });

  it('returns the ticket as eligible again once the listing is removed from the DB', async () => {
    await insertActiveListing(TARGET_PROVIDER_TICKET_ID, 'active');

    const providerUserId = await completeAuth(TARGET_PROVIDER, AVIV_USER_ID);
    const before = await dispatcher.listTickets({
      userId: AVIV_USER_ID,
      providerUserId,
      provider: TARGET_PROVIDER,
    });
    expect(
      before.find(t => t.providerTicketId === TARGET_PROVIDER_TICKET_ID)!.eligible,
    ).toBe(false);

    // Drop the listing row, then the ticket row.
    await supabaseAdmin.from('listings').delete().eq('id', createdListingId!);
    createdListingId = null;
    await supabaseAdmin.from('tickets').delete().eq('id', createdTicketId!);
    createdTicketId = null;

    const after = await dispatcher.listTickets({
      userId: AVIV_USER_ID,
      providerUserId,
      provider: TARGET_PROVIDER,
    });
    const target = after.find(t => t.providerTicketId === TARGET_PROVIDER_TICKET_ID)!;
    expect(target.eligible).toBe(true);
    expect(target.ineligibleReason).toBeNull();
  });

  it('treats a listing with status="removed" as not blocking — the override only fires for non-removed rows', async () => {
    await insertActiveListing(TARGET_PROVIDER_TICKET_ID, 'removed');

    const providerUserId = await completeAuth(TARGET_PROVIDER, AVIV_USER_ID);
    const tickets = await dispatcher.listTickets({
      userId: AVIV_USER_ID,
      providerUserId,
      provider: TARGET_PROVIDER,
    });
    const target = tickets.find(t => t.providerTicketId === TARGET_PROVIDER_TICKET_ID)!;
    expect(target.eligible).toBe(true);
    expect(target.ineligibleReason).toBeNull();
  });

  it('preserves fixture-declared ineligibility — if the fixture says non_transferable, dispatcher does not flip it to already_listed even when a row exists', async () => {
    // MOCK-EV-A-1003 is non_transferable in the fixture. Plant a listing
    // for it anyway and confirm the fixture reason wins, since the dispatcher
    // override only matters when the connector reports eligible: true.
    await insertActiveListing('MOCK-EV-A-1003');

    const providerUserId = await completeAuth(TARGET_PROVIDER, AVIV_USER_ID);
    const tickets = await dispatcher.listTickets({
      userId: AVIV_USER_ID,
      providerUserId,
      provider: TARGET_PROVIDER,
    });
    const target = tickets.find(t => t.providerTicketId === 'MOCK-EV-A-1003')!;
    expect(target.eligible).toBe(false);
    // We keep the fixture reason — the dispatcher should not paper over a
    // real provider-side ineligibility with a Safe-Ticket-side flag.
    expect(target.ineligibleReason).toBe('non_transferable');
  });

  it('returns the connector list unchanged when no Safe Ticket listings reference any fixture ticket', async () => {
    const providerUserId = await completeAuth(TARGET_PROVIDER, AVIV_USER_ID);
    const tickets = await dispatcher.listTickets({
      userId: AVIV_USER_ID,
      providerUserId,
      provider: TARGET_PROVIDER,
    });
    const fromConnector = await mockConnector.listTickets({
      provider: TARGET_PROVIDER,
      providerUserId,
    });
    expect(tickets).toEqual(fromConnector);
  });
});

describe('dispatcher — proxies to the connector', () => {
  beforeEach(() => {
    __resetMockState();
  });

  it('startAuth and handleCallback are proxied through', async () => {
    const { authUrl, state } = await dispatcher.startAuth({
      provider: 'eventim_il',
      userId: AVIV_USER_ID,
    });
    expect(new URL(authUrl).pathname).toBe('/api/sell/mock-provider/authorize');
    const cb = await dispatcher.handleCallback({
      provider: 'eventim_il',
      code: 'x',
      state,
    });
    expect(typeof cb.providerUserId).toBe('string');
  });

  it('verifyOwnership and checkTransferEligibility are proxied through', async () => {
    const providerUserId = await completeAuth('eventim_il', AVIV_USER_ID);
    const own = await dispatcher.verifyOwnership({
      provider: 'eventim_il',
      providerUserId,
      providerTicketId: 'MOCK-EV-A-1001',
    });
    expect(own).toEqual({ ok: true });

    const elig = await dispatcher.checkTransferEligibility({
      provider: 'eventim_il',
      providerUserId,
      providerTicketId: 'MOCK-EV-A-1003',
    });
    expect(elig).toEqual({ ok: false, reason: 'non_transferable' });
  });

  it('initiateTransfer and getTransferStatus surface the connector throw unchanged', async () => {
    await expect(
      dispatcher.initiateTransfer({
        provider: 'eventim_il',
        providerUserId: 'x',
        providerTicketId: 'MOCK-EV-A-1001',
        recipient: 'buyer@example.com',
      }),
    ).rejects.toBeInstanceOf(NotImplementedInPhase3Error);
    await expect(
      dispatcher.getTransferStatus({
        provider: 'eventim_il',
        transferProviderId: 'whatever',
      }),
    ).rejects.toBeInstanceOf(NotImplementedInPhase3Error);
  });
});

describe('connector factory — every supported provider routes through the mock today', () => {
  it('getConnector returns the mock for every Phase-3 slug', async () => {
    const { getConnector } = await import('../../src/connectors');
    for (const provider of ['eventim_il', 'hala', 'leaan', 'tmura'] as const) {
      expect(getConnector(provider)).toBe(mockConnector);
    }
  });
});
