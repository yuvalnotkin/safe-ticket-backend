import { describe, expect, it } from 'vitest';
import { mockConnector } from '../../src/connectors/mock';
import { NotImplementedInPhase3Error } from '../../src/connectors/types';

// initiateTransfer and getTransferStatus are part of the Phase-3 interface
// so Phase 4's buy-flow design can compile against them, but the mock
// throws on call. Nothing in Phase 3 should invoke either.

describe('mockConnector — Phase-4 transfer methods are stubs', () => {
  it('initiateTransfer throws NotImplementedInPhase3Error', async () => {
    await expect(
      mockConnector.initiateTransfer({
        provider: 'eventim_il',
        providerUserId: 'anything',
        providerTicketId: 'MOCK-EV-A-1001',
        recipient: 'buyer@example.com',
      }),
    ).rejects.toBeInstanceOf(NotImplementedInPhase3Error);
  });

  it('initiateTransfer error carries code "not_implemented_in_phase_3"', async () => {
    try {
      await mockConnector.initiateTransfer({
        provider: 'eventim_il',
        providerUserId: 'anything',
        providerTicketId: 'MOCK-EV-A-1001',
        recipient: 'buyer@example.com',
      });
      throw new Error('expected initiateTransfer to throw');
    } catch (e) {
      expect(e).toBeInstanceOf(NotImplementedInPhase3Error);
      expect((e as NotImplementedInPhase3Error).code).toBe('not_implemented_in_phase_3');
    }
  });

  it('getTransferStatus throws NotImplementedInPhase3Error', async () => {
    await expect(
      mockConnector.getTransferStatus({
        provider: 'eventim_il',
        transferProviderId: 'whatever',
      }),
    ).rejects.toBeInstanceOf(NotImplementedInPhase3Error);
  });

  it('getTransferStatus error carries code "not_implemented_in_phase_3"', async () => {
    try {
      await mockConnector.getTransferStatus({
        provider: 'eventim_il',
        transferProviderId: 'whatever',
      });
      throw new Error('expected getTransferStatus to throw');
    } catch (e) {
      expect(e).toBeInstanceOf(NotImplementedInPhase3Error);
      expect((e as NotImplementedInPhase3Error).code).toBe('not_implemented_in_phase_3');
    }
  });
});
