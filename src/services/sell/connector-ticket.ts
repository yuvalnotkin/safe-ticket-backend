import { ConnectorTicket } from '../../connectors';

// The HTTP shape for a single ticket as documented by API_CONTRACT.md
// (§ Seller, GET /api/sell/tickets and POST /api/sell/create-listing). The
// connector-internal fields `event.externalEventId` and `event.eventType`
// are intentionally stripped — they're consumed by the create-listing
// handler to populate the `events` row, not surfaced to clients.
export interface ApiConnectorTicket {
  providerTicketId: string;
  event: {
    name: string;
    date: string;
    venue: string;
    city: string;
    category: 'sports' | 'culture';
  };
  seat: {
    section: string;
    row?: string;
    seat?: string;
  };
  faceValueAgorot: number;
  eligible: boolean;
  ineligibleReason: ConnectorTicket['ineligibleReason'];
}

export const toApiConnectorTicket = (t: ConnectorTicket): ApiConnectorTicket => ({
  providerTicketId: t.providerTicketId,
  event: {
    name: t.event.name,
    date: t.event.date,
    venue: t.event.venue,
    city: t.event.city,
    category: t.event.category,
  },
  seat: {
    section: t.seat.section,
    ...(t.seat.row !== undefined ? { row: t.seat.row } : {}),
    ...(t.seat.seat !== undefined ? { seat: t.seat.seat } : {}),
  },
  faceValueAgorot: t.faceValueAgorot,
  eligible: t.eligible,
  ineligibleReason: t.ineligibleReason,
});
