import { createHash, randomBytes } from 'crypto';
import { env } from '../utils/env';
import {
  AVIV_USER_ID,
  NOA_USER_ID,
  fixtureOwnerOfTicket,
  ticketsForUser,
} from './fixtures';
import {
  CallbackResult,
  Connector,
  ConnectorTicket,
  GetTransferStatusInput,
  HandleCallbackInput,
  InitiateTransferInput,
  InitiateTransferResult,
  ListTicketsInput,
  NotImplementedInPhase3Error,
  ProviderSlug,
  StartAuthInput,
  StartAuthResult,
  TransferStatus,
  VerifyInput,
  VerifyResult,
} from './types';

export { AVIV_USER_ID, NOA_USER_ID };

const STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const ACCESS_TOKEN_TTL_SECONDS = 60 * 60; // 1 hour

type StateRecord = {
  provider: ProviderSlug;
  userId: string;
  issuedAt: number;
};

// State store + access-token counter are module-level so the mock is
// stateful across calls within a process. `__resetMockState` clears them
// for test isolation.
const stateStore = new Map<string, StateRecord>();
let accessTokenCounter = 0;

const stableProviderUserId = (provider: ProviderSlug, userId: string): string => {
  const hash = createHash('sha256')
    .update(`${provider}:${userId}`)
    .digest('hex')
    .slice(0, 16);
  return `mock-${provider}-${hash}`;
};

const startAuth = async ({
  provider,
  userId,
}: StartAuthInput): Promise<StartAuthResult> => {
  const state = randomBytes(16).toString('hex');
  stateStore.set(state, { provider, userId, issuedAt: Date.now() });
  const url = new URL('/api/sell/mock-provider/authorize', env.PUBLIC_BACKEND_URL);
  url.searchParams.set('state', state);
  url.searchParams.set('provider', provider);
  return { authUrl: url.toString(), state };
};

const handleCallback = async ({
  provider,
  state,
}: HandleCallbackInput): Promise<CallbackResult> => {
  const record = stateStore.get(state);
  if (!record) {
    throw new Error('invalid_state: unknown or already-consumed state token');
  }
  if (Date.now() - record.issuedAt > STATE_TTL_MS) {
    stateStore.delete(state);
    throw new Error('invalid_state: state token expired');
  }
  if (record.provider !== provider) {
    throw new Error(
      `invalid_state: state was issued for provider "${record.provider}", not "${provider}"`,
    );
  }

  // State is single-use.
  stateStore.delete(state);

  accessTokenCounter += 1;
  const accessToken = `mock-token-${accessTokenCounter}-${randomBytes(8).toString('hex')}`;

  return {
    providerUserId: stableProviderUserId(provider, record.userId),
    accessToken,
    expiresAt: Math.floor(Date.now() / 1000) + ACCESS_TOKEN_TTL_SECONDS,
  };
};

// The mock fixtures are keyed by (provider, safeTicketUserId), but
// listTickets receives a `providerUserId`. Resolve back to the underlying
// safeTicketUserId by re-deriving the providerUserId for every known fixture
// holder. With only two seeded users, this is O(2) — cheap and avoids
// maintaining a side-channel reverse map.
const FIXTURE_USER_IDS = [AVIV_USER_ID, NOA_USER_ID] as const;

const resolveFixtureUser = (
  provider: ProviderSlug,
  providerUserId: string,
): string | null => {
  for (const userId of FIXTURE_USER_IDS) {
    if (stableProviderUserId(provider, userId) === providerUserId) return userId;
  }
  return null;
};

const listTickets = async ({
  provider,
  providerUserId,
}: ListTicketsInput): Promise<ConnectorTicket[]> => {
  const userId = resolveFixtureUser(provider, providerUserId);
  if (!userId) return [];
  return ticketsForUser(provider, userId);
};

const verifyOwnership = async ({
  provider,
  providerUserId,
  providerTicketId,
}: VerifyInput): Promise<VerifyResult> => {
  const found = fixtureOwnerOfTicket(provider, providerTicketId);
  if (!found) return { ok: false, reason: 'ownership_mismatch' };
  if (stableProviderUserId(provider, found.userId) !== providerUserId) {
    return { ok: false, reason: 'ownership_mismatch' };
  }
  return { ok: true };
};

const checkTransferEligibility = async ({
  provider,
  providerUserId,
  providerTicketId,
}: VerifyInput): Promise<VerifyResult> => {
  const found = fixtureOwnerOfTicket(provider, providerTicketId);
  if (!found) return { ok: false, reason: 'ownership_mismatch' };
  if (stableProviderUserId(provider, found.userId) !== providerUserId) {
    return { ok: false, reason: 'ownership_mismatch' };
  }
  if (found.ticket.eligible) return { ok: true };
  // ineligibleReason is non-null when eligible is false (asserted by the
  // ConnectorTicket invariant — fixtures are typed accordingly).
  return { ok: false, reason: found.ticket.ineligibleReason! };
};

const initiateTransfer = async (
  _input: InitiateTransferInput,
): Promise<InitiateTransferResult> => {
  throw new NotImplementedInPhase3Error('initiateTransfer');
};

const getTransferStatus = async (
  _input: GetTransferStatusInput,
): Promise<TransferStatus> => {
  throw new NotImplementedInPhase3Error('getTransferStatus');
};

export const mockConnector: Connector = {
  startAuth,
  handleCallback,
  listTickets,
  verifyOwnership,
  checkTransferEligibility,
  initiateTransfer,
  getTransferStatus,
};

// Test-only helper. Not exported from the connectors module's public
// surface; tests reach in via the direct path.
export const __resetMockState = (): void => {
  stateStore.clear();
  accessTokenCounter = 0;
};
