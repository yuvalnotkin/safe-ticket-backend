import { beforeEach, describe, expect, it } from 'vitest';
import {
  AVIV_USER_ID,
  NOA_USER_ID,
  mockConnector,
  __resetMockState,
} from '../../src/connectors/mock';
import { IneligibleReason, ProviderSlug } from '../../src/connectors/types';

const completeAuth = async (
  provider: ProviderSlug,
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

describe('mockConnector — verifyOwnership', () => {
  beforeEach(() => {
    __resetMockState();
  });

  it('returns ok:true for a ticket the user owns in the fixture', async () => {
    const providerUserId = await completeAuth('eventim_il', AVIV_USER_ID);
    const result = await mockConnector.verifyOwnership({
      provider: 'eventim_il',
      providerUserId,
      providerTicketId: 'MOCK-EV-A-1001',
    });
    expect(result).toEqual({ ok: true });
  });

  it("returns ownership_mismatch when the ticket belongs to a different user under the same provider", async () => {
    // MOCK-HL-B-3001 belongs to Noa on hala. Query under Aviv's hala providerUserId.
    const avivHalaPuid = await completeAuth('hala', AVIV_USER_ID);
    const result = await mockConnector.verifyOwnership({
      provider: 'hala',
      providerUserId: avivHalaPuid,
      providerTicketId: 'MOCK-HL-B-3001',
    });
    expect(result).toEqual({ ok: false, reason: 'ownership_mismatch' });
  });

  it('returns ownership_mismatch for an unknown providerTicketId (defensive: never assume ownership)', async () => {
    const providerUserId = await completeAuth('eventim_il', AVIV_USER_ID);
    const result = await mockConnector.verifyOwnership({
      provider: 'eventim_il',
      providerUserId,
      providerTicketId: 'MOCK-EV-DOES-NOT-EXIST',
    });
    expect(result).toEqual({ ok: false, reason: 'ownership_mismatch' });
  });

  it('is deterministic — repeated calls return the same answer', async () => {
    const providerUserId = await completeAuth('eventim_il', AVIV_USER_ID);
    const r1 = await mockConnector.verifyOwnership({
      provider: 'eventim_il',
      providerUserId,
      providerTicketId: 'MOCK-EV-A-1001',
    });
    const r2 = await mockConnector.verifyOwnership({
      provider: 'eventim_il',
      providerUserId,
      providerTicketId: 'MOCK-EV-A-1001',
    });
    expect(r2).toEqual(r1);
  });
});

describe('mockConnector — checkTransferEligibility', () => {
  beforeEach(() => {
    __resetMockState();
  });

  it('returns ok:true for a ticket whose fixture is eligible: true', async () => {
    const providerUserId = await completeAuth('eventim_il', AVIV_USER_ID);
    const result = await mockConnector.checkTransferEligibility({
      provider: 'eventim_il',
      providerUserId,
      providerTicketId: 'MOCK-EV-A-1001',
    });
    expect(result).toEqual({ ok: true });
  });

  it('returns the fixture-declared reason when the ticket is non_transferable', async () => {
    const providerUserId = await completeAuth('eventim_il', AVIV_USER_ID);
    const result = await mockConnector.checkTransferEligibility({
      provider: 'eventim_il',
      providerUserId,
      providerTicketId: 'MOCK-EV-A-1003',
    });
    expect(result).toEqual({ ok: false, reason: 'non_transferable' });
  });

  it('returns event_passed for the past-event fixture', async () => {
    const providerUserId = await completeAuth('leaan', AVIV_USER_ID);
    const result = await mockConnector.checkTransferEligibility({
      provider: 'leaan',
      providerUserId,
      providerTicketId: 'MOCK-LN-A-2002',
    });
    expect(result).toEqual({ ok: false, reason: 'event_passed' });
  });

  it('returns already_transferred for the already-transferred fixture', async () => {
    const providerUserId = await completeAuth('hala', NOA_USER_ID);
    const result = await mockConnector.checkTransferEligibility({
      provider: 'hala',
      providerUserId,
      providerTicketId: 'MOCK-HL-B-3003',
    });
    expect(result).toEqual({ ok: false, reason: 'already_transferred' });
  });

  it('never returns already_listed_on_safe_ticket — that reason is dispatcher-only', async () => {
    // Survey every fixture; the raw connector must never surface this reason.
    const seenReasons = new Set<IneligibleReason | null>();
    for (const userId of [AVIV_USER_ID, NOA_USER_ID]) {
      for (const provider of ['eventim_il', 'hala', 'leaan', 'tmura'] as const) {
        const puid = await completeAuth(provider, userId);
        const tickets = await mockConnector.listTickets({ provider, providerUserId: puid });
        for (const t of tickets) {
          const r = await mockConnector.checkTransferEligibility({
            provider,
            providerUserId: puid,
            providerTicketId: t.providerTicketId,
          });
          if (r.ok === false) seenReasons.add(r.reason);
          else seenReasons.add(null);
        }
      }
    }
    expect(seenReasons.has('already_listed_on_safe_ticket')).toBe(false);
  });

  it('returns ownership_mismatch when called for a ticket the user does not own', async () => {
    const avivHalaPuid = await completeAuth('hala', AVIV_USER_ID);
    const result = await mockConnector.checkTransferEligibility({
      provider: 'hala',
      providerUserId: avivHalaPuid,
      providerTicketId: 'MOCK-HL-B-3001', // Noa's
    });
    expect(result).toEqual({ ok: false, reason: 'ownership_mismatch' });
  });

  it('is deterministic — repeated calls return the same answer', async () => {
    const providerUserId = await completeAuth('eventim_il', AVIV_USER_ID);
    const r1 = await mockConnector.checkTransferEligibility({
      provider: 'eventim_il',
      providerUserId,
      providerTicketId: 'MOCK-EV-A-1003',
    });
    const r2 = await mockConnector.checkTransferEligibility({
      provider: 'eventim_il',
      providerUserId,
      providerTicketId: 'MOCK-EV-A-1003',
    });
    expect(r2).toEqual(r1);
  });
});
