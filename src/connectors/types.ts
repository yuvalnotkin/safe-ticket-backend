// Connector interface shared by every ticketing-provider integration.
// Phase 3 ships only the mock implementation; Phase 5 swaps in real ones
// behind the same surface.

export const PROVIDER_SLUGS = ['eventim_il', 'hala', 'leaan', 'tmura'] as const;
export type ProviderSlug = (typeof PROVIDER_SLUGS)[number];

export const isProviderSlug = (value: unknown): value is ProviderSlug =>
  typeof value === 'string' && (PROVIDER_SLUGS as readonly string[]).includes(value);

export type IneligibleReason =
  | 'already_transferred'
  | 'event_passed'
  | 'non_transferable'
  | 'ownership_mismatch'
  // Set only by the dispatcher (the raw connector knows nothing about Safe
  // Ticket-side state), but lives on the same union so callers handle it
  // uniformly.
  | 'already_listed_on_safe_ticket';

export type EventCategory = 'sports' | 'culture';

// Mirrors the DB `event_type` enum in migration 0001. `create-listing` reads
// `eventType` for the `events.event_type` column; the public API exposes the
// coarser-grained `category` ('sports' | 'culture') the contract documents.
export type EventType = 'concert' | 'sport' | 'theater' | 'festival' | 'other';

export interface ConnectorTicketEvent {
  // Stable per-provider event identifier. Multiple tickets to the same event
  // share the same value; the create-listing handler upserts on
  // (provider_id, externalEventId).
  externalEventId: string;
  name: string;
  date: string; // ISO 8601 in UTC
  venue: string;
  city: string;
  category: EventCategory;
  eventType: EventType;
}

export interface ConnectorTicketSeat {
  section: string;
  row?: string;
  seat?: string;
}

export interface ConnectorTicket {
  providerTicketId: string;
  event: ConnectorTicketEvent;
  seat: ConnectorTicketSeat;
  faceValueAgorot: number;
  eligible: boolean;
  ineligibleReason: IneligibleReason | null;
}

export interface StartAuthInput {
  provider: ProviderSlug;
  userId: string;
}

export interface StartAuthResult {
  authUrl: string;
  state: string;
}

export interface HandleCallbackInput {
  provider: ProviderSlug;
  code: string;
  state: string;
}

export interface CallbackResult {
  providerUserId: string;
  accessToken: string;
  refreshToken?: string;
  expiresAt: number; // unix seconds
}

export interface ListTicketsInput {
  provider: ProviderSlug;
  providerUserId: string;
}

export interface VerifyInput {
  provider: ProviderSlug;
  providerUserId: string;
  providerTicketId: string;
}

export type VerifyResult =
  | { ok: true }
  | { ok: false; reason: IneligibleReason };

export interface InitiateTransferInput {
  provider: ProviderSlug;
  providerUserId: string;
  providerTicketId: string;
  recipient: string;
}

export interface InitiateTransferResult {
  transferProviderId: string;
}

export interface GetTransferStatusInput {
  provider: ProviderSlug;
  transferProviderId: string;
}

export type TransferStatus = 'pending' | 'completed' | 'failed';

export interface Connector {
  startAuth(input: StartAuthInput): Promise<StartAuthResult>;
  handleCallback(input: HandleCallbackInput): Promise<CallbackResult>;
  listTickets(input: ListTicketsInput): Promise<ConnectorTicket[]>;
  verifyOwnership(input: VerifyInput): Promise<VerifyResult>;
  checkTransferEligibility(input: VerifyInput): Promise<VerifyResult>;
  initiateTransfer(input: InitiateTransferInput): Promise<InitiateTransferResult>;
  getTransferStatus(input: GetTransferStatusInput): Promise<TransferStatus>;
}

// Thrown by `initiateTransfer` / `getTransferStatus` on the Phase-3 mock —
// defined on the interface so Phase 4 can wire the buy flow against it, but
// nobody is meant to call these yet.
export class NotImplementedInPhase3Error extends Error {
  readonly code = 'not_implemented_in_phase_3';
  constructor(method: string) {
    super(`${method} is not implemented in Phase 3`);
    this.name = 'NotImplementedInPhase3Error';
  }
}
