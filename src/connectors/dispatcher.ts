import { supabaseAdmin } from '../utils/supabase';
import {
  CallbackResult,
  Connector,
  ConnectorTicket,
  GetTransferStatusInput,
  HandleCallbackInput,
  InitiateTransferInput,
  InitiateTransferResult,
  ProviderSlug,
  StartAuthInput,
  StartAuthResult,
  TransferStatus,
  VerifyInput,
  VerifyResult,
} from './types';

export interface DispatcherListTicketsInput {
  /** Safe Ticket user id (the caller). */
  userId: string;
  /** Provider-side identifier resolved from a prior callback. */
  providerUserId: string;
  provider: ProviderSlug;
}

/**
 * Looks up provider-ticket-ids that already have a non-`removed` listing
 * row in our DB. Returns a Set of providerTicketIds present in the input
 * that are already listed.
 */
export type AlreadyListedChecker = (
  provider: ProviderSlug,
  providerTicketIds: string[],
) => Promise<Set<string>>;

/**
 * Default checker — queries `tickets` joined with `listings` for rows whose
 * status is not `removed`. Returns the set of `external_ticket_id` values
 * that match any of the requested provider-ticket-ids under the given
 * provider slug.
 */
export const defaultAlreadyListedChecker: AlreadyListedChecker = async (
  provider,
  providerTicketIds,
) => {
  if (providerTicketIds.length === 0) return new Set();

  const { data: providerRow, error: providerErr } = await supabaseAdmin
    .from('providers')
    .select('id')
    .eq('slug', provider)
    .maybeSingle();
  if (providerErr) throw new Error(`provider lookup failed: ${providerErr.message}`);
  if (!providerRow) return new Set();

  const { data, error } = await supabaseAdmin
    .from('tickets')
    .select('external_ticket_id, listings!inner(status)')
    .eq('provider_id', providerRow.id as string)
    .in('external_ticket_id', providerTicketIds)
    .neq('listings.status', 'removed');
  if (error) throw new Error(`already-listed query failed: ${error.message}`);

  const matched = new Set<string>();
  for (const row of (data ?? []) as Array<{ external_ticket_id: string }>) {
    matched.add(row.external_ticket_id);
  }
  return matched;
};

export interface Dispatcher {
  startAuth(input: StartAuthInput): Promise<StartAuthResult>;
  handleCallback(input: HandleCallbackInput): Promise<CallbackResult>;
  listTickets(input: DispatcherListTicketsInput): Promise<ConnectorTicket[]>;
  verifyOwnership(input: VerifyInput): Promise<VerifyResult>;
  checkTransferEligibility(input: VerifyInput): Promise<VerifyResult>;
  initiateTransfer(input: InitiateTransferInput): Promise<InitiateTransferResult>;
  getTransferStatus(input: GetTransferStatusInput): Promise<TransferStatus>;
}

/**
 * Returns the same `ConnectorTicket[]` shape as the raw connector, with the
 * `already_listed_on_safe_ticket` override applied for any ticket whose
 * providerTicketId has a non-`removed` row in our `listings` table. Tickets
 * that are already ineligible per the connector keep their original reason
 * — the override only matters for tickets the connector reports as eligible.
 */
const applyAlreadyListedOverride = (
  tickets: ConnectorTicket[],
  alreadyListed: Set<string>,
): ConnectorTicket[] =>
  tickets.map(t =>
    t.eligible && alreadyListed.has(t.providerTicketId)
      ? { ...t, eligible: false, ineligibleReason: 'already_listed_on_safe_ticket' }
      : t,
  );

export const buildDispatcher = (
  getConnector: (provider: ProviderSlug) => Connector,
  alreadyListedChecker: AlreadyListedChecker = defaultAlreadyListedChecker,
): Dispatcher => ({
  startAuth: input => getConnector(input.provider).startAuth(input),
  handleCallback: input => getConnector(input.provider).handleCallback(input),
  listTickets: async ({ provider, providerUserId }) => {
    const tickets = await getConnector(provider).listTickets({ provider, providerUserId });
    const alreadyListed = await alreadyListedChecker(
      provider,
      tickets.map(t => t.providerTicketId),
    );
    return applyAlreadyListedOverride(tickets, alreadyListed);
  },
  verifyOwnership: input => getConnector(input.provider).verifyOwnership(input),
  checkTransferEligibility: input =>
    getConnector(input.provider).checkTransferEligibility(input),
  initiateTransfer: input => getConnector(input.provider).initiateTransfer(input),
  getTransferStatus: input => getConnector(input.provider).getTransferStatus(input),
});
