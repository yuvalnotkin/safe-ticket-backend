// Connector layer — every provider-specific integration sits behind this
// uniform surface. Phase 3 ships only the mock connector for all four
// supported provider slugs. Phase 5 swaps real connectors in by editing the
// factory below; no code above this module should change.

import { buildDispatcher } from './dispatcher';
import { mockConnector } from './mock';
import { Connector, ProviderSlug } from './types';

const REGISTRY: Record<ProviderSlug, Connector> = {
  eventim_il: mockConnector,
  hala: mockConnector,
  leaan: mockConnector,
  tmura: mockConnector,
};

/**
 * Returns the connector implementation for a provider slug. The dispatcher
 * uses this; HTTP handlers should call the dispatcher, never `getConnector`
 * directly — that's where the `already_listed_on_safe_ticket` override lives.
 */
export const getConnector = (provider: ProviderSlug): Connector => REGISTRY[provider];

/** The dispatcher every HTTP handler should call. */
export const dispatcher = buildDispatcher(getConnector);

export * from './types';
export { Dispatcher, AlreadyListedChecker, defaultAlreadyListedChecker, buildDispatcher } from './dispatcher';
