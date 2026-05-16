import { ConnectorTicket, ProviderSlug } from './types';

// Hard-coded Safe Ticket user UUIDs, mirroring `supabase/seed.sql`.
// These are the two locally-seeded sellers; their mock provider inventory
// is curated below.
export const AVIV_USER_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
export const NOA_USER_ID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

// providerTicketId values use a `MOCK-` prefix to keep the in-process
// fixture inventory clearly separate from the seeded `tickets.external_ticket_id`
// values in the DB (which use `TKT-` prefixes). Phase 2 listings reference
// TKT-* tickets; Phase 3 mock fixtures live in their own namespace so the
// dispatcher's `already_listed_on_safe_ticket` check is unambiguous.

export interface FixtureKey {
  provider: ProviderSlug;
  userId: string;
}

interface FixtureEntry extends FixtureKey {
  tickets: ConnectorTicket[];
}

// Spread across both seeded users so the UI can exercise:
//   - eligible: true for typical purchase flow
//   - ineligibleReason: "already_transferred" / "event_passed" / "non_transferable"
//
// The dispatcher injects "already_listed_on_safe_ticket" at the next layer.
// "ownership_mismatch" is only ever returned by verifyOwnership — it doesn't
// appear in listTickets fixtures.
const FIXTURES: FixtureEntry[] = [
  // ── Aviv on eventim_il (4 tickets) ───────────────────────────────────────
  {
    provider: 'eventim_il',
    userId: AVIV_USER_ID,
    tickets: [
      {
        providerTicketId: 'MOCK-EV-A-1001',
        event: {
          externalEventId: 'MOCK-EVT-EV-1',
          name: 'Maccabi TA vs Hapoel TA',
          date: '2026-08-09T18:30:00.000Z',
          venue: 'Bloomfield Stadium',
          city: 'Tel Aviv',
          category: 'sports',
          eventType: 'sport',
        },
        seat: { section: 'East', row: '14', seat: '22' },
        faceValueAgorot: 18000,
        eligible: true,
        ineligibleReason: null,
      },
      {
        providerTicketId: 'MOCK-EV-A-1002',
        event: {
          externalEventId: 'MOCK-EVT-EV-2',
          name: 'Beitar Jerusalem vs Maccabi Haifa',
          date: '2026-08-23T19:00:00.000Z',
          venue: 'Teddy Stadium',
          city: 'Jerusalem',
          category: 'sports',
          eventType: 'sport',
        },
        seat: { section: 'West', row: '5', seat: '12' },
        faceValueAgorot: 22000,
        eligible: true,
        ineligibleReason: null,
      },
      {
        providerTicketId: 'MOCK-EV-A-1003',
        event: {
          externalEventId: 'MOCK-EVT-EV-3',
          name: 'Maccabi TA vs Olympiacos (EuroLeague)',
          date: '2026-09-30T20:00:00.000Z',
          venue: 'Menora Mivtachim Arena',
          city: 'Tel Aviv',
          category: 'sports',
          eventType: 'sport',
        },
        seat: { section: 'Lower', row: 'C', seat: '18' },
        faceValueAgorot: 55000,
        eligible: false,
        ineligibleReason: 'non_transferable',
      },
      {
        providerTicketId: 'MOCK-EV-A-1004',
        event: {
          externalEventId: 'MOCK-EVT-EV-4',
          name: 'Israel Philharmonic Orchestra',
          date: '2026-11-04T20:00:00.000Z',
          venue: 'Haifa Auditorium',
          city: 'Haifa',
          category: 'culture',
          eventType: 'concert',
        },
        seat: { section: 'Stalls', row: '12', seat: '20' },
        faceValueAgorot: 32000,
        eligible: true,
        ineligibleReason: null,
      },
    ],
  },
  // ── Aviv on leaan (2 tickets) ───────────────────────────────────────────
  {
    provider: 'leaan',
    userId: AVIV_USER_ID,
    tickets: [
      {
        providerTicketId: 'MOCK-LN-A-2001',
        event: {
          externalEventId: 'MOCK-EVT-LN-1',
          name: 'Idan Raichel Live',
          date: '2026-08-14T19:00:00.000Z',
          venue: 'Hayarkon Park',
          city: 'Tel Aviv',
          category: 'culture',
          eventType: 'concert',
        },
        seat: { section: 'GA' },
        faceValueAgorot: 35000,
        eligible: true,
        ineligibleReason: null,
      },
      {
        providerTicketId: 'MOCK-LN-A-2002',
        event: {
          externalEventId: 'MOCK-EVT-LN-2',
          name: 'Static & Ben El',
          date: '2026-04-15T20:30:00.000Z', // past — today is 2026-05-15
          venue: 'Menora Mivtachim Arena',
          city: 'Tel Aviv',
          category: 'culture',
          eventType: 'concert',
        },
        seat: { section: 'A', row: '5', seat: '12' },
        faceValueAgorot: 42000,
        eligible: false,
        ineligibleReason: 'event_passed',
      },
    ],
  },
  // ── Noa on hala (3 tickets) ─────────────────────────────────────────────
  {
    provider: 'hala',
    userId: NOA_USER_ID,
    tickets: [
      {
        providerTicketId: 'MOCK-HL-B-3001',
        event: {
          externalEventId: 'MOCK-EVT-HL-1',
          name: 'Hamlet',
          date: '2026-07-12T20:00:00.000Z',
          venue: 'Habima Theatre',
          city: 'Tel Aviv',
          category: 'culture',
          eventType: 'theater',
        },
        seat: { section: 'Stalls', row: '7', seat: '14' },
        faceValueAgorot: 28000,
        eligible: true,
        ineligibleReason: null,
      },
      {
        providerTicketId: 'MOCK-HL-B-3002',
        event: {
          externalEventId: 'MOCK-EVT-HL-2',
          name: 'The Cherry Orchard',
          date: '2026-08-20T19:30:00.000Z',
          venue: 'Jerusalem Theatre',
          city: 'Jerusalem',
          category: 'culture',
          eventType: 'theater',
        },
        seat: { section: 'Mezz', row: '3', seat: '8' },
        faceValueAgorot: 24000,
        eligible: true,
        ineligibleReason: null,
      },
      {
        providerTicketId: 'MOCK-HL-B-3003',
        event: {
          externalEventId: 'MOCK-EVT-HL-3',
          name: 'Tech Conference 2026',
          date: '2026-10-08T09:00:00.000Z',
          venue: 'Expo Tel Aviv',
          city: 'Tel Aviv',
          category: 'culture',
          eventType: 'other',
        },
        seat: { section: 'Standard' },
        faceValueAgorot: 89000,
        eligible: false,
        ineligibleReason: 'already_transferred',
      },
    ],
  },
  // ── Noa on tmura (2 tickets) ────────────────────────────────────────────
  {
    provider: 'tmura',
    userId: NOA_USER_ID,
    tickets: [
      {
        providerTicketId: 'MOCK-TM-B-4001',
        event: {
          externalEventId: 'MOCK-EVT-TM-1',
          name: 'Red Sea Jazz Festival — Opening Night',
          date: '2026-08-25T21:00:00.000Z',
          venue: 'Eilat Port',
          city: 'Eilat',
          category: 'culture',
          eventType: 'festival',
        },
        seat: { section: 'VIP' },
        faceValueAgorot: 88000,
        eligible: true,
        ineligibleReason: null,
      },
      {
        providerTicketId: 'MOCK-TM-B-4002',
        event: {
          externalEventId: 'MOCK-EVT-TM-2',
          name: 'Tel Aviv Pride Concert',
          date: '2026-09-13T18:00:00.000Z',
          venue: 'Park HaYarkon',
          city: 'Tel Aviv',
          category: 'culture',
          eventType: 'concert',
        },
        seat: { section: 'GA' },
        faceValueAgorot: 19000,
        eligible: true,
        ineligibleReason: null,
      },
    ],
  },
];

const cloneTicket = (t: ConnectorTicket): ConnectorTicket => ({
  ...t,
  event: { ...t.event },
  seat: { ...t.seat },
});

/** Returns all fixture tickets for a (provider, userId) pair. Empty if unknown. */
export const ticketsForUser = (
  provider: ProviderSlug,
  userId: string,
): ConnectorTicket[] => {
  const entry = FIXTURES.find(
    f => f.provider === provider && f.userId === userId,
  );
  return entry ? entry.tickets.map(cloneTicket) : [];
};

/**
 * Returns the safeTicketUserId that owns the given (provider, providerTicketId)
 * in the fixtures, or null if the ticket is unknown to this provider. Used by
 * verifyOwnership to detect ownership_mismatch vs. unknown-ticket cases.
 */
export const fixtureOwnerOfTicket = (
  provider: ProviderSlug,
  providerTicketId: string,
): { userId: string; ticket: ConnectorTicket } | null => {
  for (const entry of FIXTURES) {
    if (entry.provider !== provider) continue;
    const ticket = entry.tickets.find(t => t.providerTicketId === providerTicketId);
    if (ticket) return { userId: entry.userId, ticket: cloneTicket(ticket) };
  }
  return null;
};

/** Test-only helper: enumerate every fixture for assertions. */
export const allFixtureTickets = (): Array<{
  provider: ProviderSlug;
  userId: string;
  ticket: ConnectorTicket;
}> =>
  FIXTURES.flatMap(entry =>
    entry.tickets.map(ticket => ({
      provider: entry.provider,
      userId: entry.userId,
      ticket: cloneTicket(ticket),
    })),
  );
