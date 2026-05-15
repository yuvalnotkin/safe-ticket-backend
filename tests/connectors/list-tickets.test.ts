import { beforeEach, describe, expect, it } from 'vitest';
import { ConnectorTicket, IneligibleReason } from '../../src/connectors/types';
import {
  AVIV_USER_ID,
  NOA_USER_ID,
  mockConnector,
  __resetMockState,
} from '../../src/connectors/mock';

const completeAuth = async (
  provider: 'eventim_il' | 'hala' | 'leaan' | 'tmura',
  userId: string,
): Promise<string> => {
  const { state } = await mockConnector.startAuth({ provider, userId });
  const cb = await mockConnector.handleCallback({
    provider,
    code: 'mock-code',
    state,
  });
  return cb.providerUserId;
};

const expectValidTicket = (t: ConnectorTicket) => {
  expect(typeof t.providerTicketId).toBe('string');
  expect(t.providerTicketId.length).toBeGreaterThan(0);
  expect(typeof t.event.name).toBe('string');
  expect(typeof t.event.date).toBe('string');
  expect(() => new Date(t.event.date).toISOString()).not.toThrow();
  expect(typeof t.event.venue).toBe('string');
  expect(typeof t.event.city).toBe('string');
  expect(['sports', 'culture']).toContain(t.event.category);
  expect(typeof t.seat.section).toBe('string');
  expect(Number.isInteger(t.faceValueAgorot)).toBe(true);
  expect(t.faceValueAgorot).toBeGreaterThan(0);
  if (t.eligible) {
    expect(t.ineligibleReason).toBeNull();
  } else {
    expect(t.ineligibleReason).not.toBeNull();
  }
};

describe('mockConnector — listTickets fixtures', () => {
  beforeEach(() => {
    __resetMockState();
  });

  it('Aviv has 4 tickets on eventim_il', async () => {
    const providerUserId = await completeAuth('eventim_il', AVIV_USER_ID);
    const tickets = await mockConnector.listTickets({
      provider: 'eventim_il',
      providerUserId,
    });
    expect(tickets).toHaveLength(4);
    for (const t of tickets) expectValidTicket(t);
  });

  it('Aviv has 2 tickets on leaan', async () => {
    const providerUserId = await completeAuth('leaan', AVIV_USER_ID);
    const tickets = await mockConnector.listTickets({
      provider: 'leaan',
      providerUserId,
    });
    expect(tickets).toHaveLength(2);
    for (const t of tickets) expectValidTicket(t);
  });

  it('Aviv has no tickets on hala or tmura', async () => {
    const halaPuid = await completeAuth('hala', AVIV_USER_ID);
    const tmuraPuid = await completeAuth('tmura', AVIV_USER_ID);
    expect(await mockConnector.listTickets({ provider: 'hala', providerUserId: halaPuid })).toEqual([]);
    expect(await mockConnector.listTickets({ provider: 'tmura', providerUserId: tmuraPuid })).toEqual([]);
  });

  it('Noa has 3 tickets on hala', async () => {
    const providerUserId = await completeAuth('hala', NOA_USER_ID);
    const tickets = await mockConnector.listTickets({
      provider: 'hala',
      providerUserId,
    });
    expect(tickets).toHaveLength(3);
    for (const t of tickets) expectValidTicket(t);
  });

  it('Noa has 2 tickets on tmura', async () => {
    const providerUserId = await completeAuth('tmura', NOA_USER_ID);
    const tickets = await mockConnector.listTickets({
      provider: 'tmura',
      providerUserId,
    });
    expect(tickets).toHaveLength(2);
    for (const t of tickets) expectValidTicket(t);
  });

  it('Noa has no tickets on eventim_il or leaan', async () => {
    const eventimPuid = await completeAuth('eventim_il', NOA_USER_ID);
    const leaanPuid = await completeAuth('leaan', NOA_USER_ID);
    expect(
      await mockConnector.listTickets({ provider: 'eventim_il', providerUserId: eventimPuid }),
    ).toEqual([]);
    expect(
      await mockConnector.listTickets({ provider: 'leaan', providerUserId: leaanPuid }),
    ).toEqual([]);
  });

  it('an unknown providerUserId returns an empty list', async () => {
    const tickets = await mockConnector.listTickets({
      provider: 'eventim_il',
      providerUserId: 'mock-eventim_il-deadbeef-nobody',
    });
    expect(tickets).toEqual([]);
  });

  it('combined fixtures cover every concrete IneligibleReason at least once', async () => {
    const all: ConnectorTicket[] = [];
    for (const userId of [AVIV_USER_ID, NOA_USER_ID]) {
      for (const provider of ['eventim_il', 'hala', 'leaan', 'tmura'] as const) {
        const puid = await completeAuth(provider, userId);
        all.push(...(await mockConnector.listTickets({ provider, providerUserId: puid })));
      }
    }
    const reasons = new Set<IneligibleReason | null>(all.map(t => t.ineligibleReason));
    expect(reasons.has('already_transferred')).toBe(true);
    expect(reasons.has('event_passed')).toBe(true);
    expect(reasons.has('non_transferable')).toBe(true);
    // ownership_mismatch is not surfaced by listTickets — only by verifyOwnership.
    // already_listed_on_safe_ticket is set only by the dispatcher, never the raw connector.
    expect(reasons.has('already_listed_on_safe_ticket')).toBe(false);
    expect(reasons.has('ownership_mismatch')).toBe(false);
  });

  it('listTickets is deterministic and side-effect-free — repeated calls return identical results', async () => {
    const providerUserId = await completeAuth('eventim_il', AVIV_USER_ID);
    const first = await mockConnector.listTickets({ provider: 'eventim_il', providerUserId });
    const second = await mockConnector.listTickets({ provider: 'eventim_il', providerUserId });
    const third = await mockConnector.listTickets({ provider: 'eventim_il', providerUserId });
    expect(second).toEqual(first);
    expect(third).toEqual(first);
  });

  it('every fixture ticket carries a unique providerTicketId across the whole dataset', async () => {
    const all: ConnectorTicket[] = [];
    for (const userId of [AVIV_USER_ID, NOA_USER_ID]) {
      for (const provider of ['eventim_il', 'hala', 'leaan', 'tmura'] as const) {
        const puid = await completeAuth(provider, userId);
        all.push(...(await mockConnector.listTickets({ provider, providerUserId: puid })));
      }
    }
    const ids = all.map(t => t.providerTicketId);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
