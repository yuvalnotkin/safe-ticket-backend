import { supabaseAdmin } from '../../utils/supabase';
import { AppError } from '../../middleware/error';
import { calculateServiceFeeAgorot } from '../../utils/fees';
import { ConnectorTicket, ProviderSlug } from '../../connectors';
import { ListingResponse } from '../listings.mapper';

export interface CreateListingInput {
  userId: string;
  provider: ProviderSlug;
  ticket: ConnectorTicket;
}

interface RpcRow {
  out_listing_id: string;
  out_listing_created_at: string;
  out_event_id: string;
  out_ticket_id: string;
  out_face_value_agorot: number;
}

export const createListingAtomic = async ({
  userId,
  provider,
  ticket,
}: CreateListingInput): Promise<ListingResponse> => {
  const { data, error } = await supabaseAdmin.rpc('create_listing_from_connector', {
    p_user_id: userId,
    p_provider_slug: provider,
    p_external_event_id: ticket.event.externalEventId,
    p_event_title: ticket.event.name,
    p_event_type: ticket.event.eventType,
    p_event_venue_name: ticket.event.venue,
    p_event_city: ticket.event.city,
    p_event_country: 'IL',
    p_event_starts_at: ticket.event.date,
    p_external_ticket_id: ticket.providerTicketId,
    p_section: ticket.seat.section,
    p_row: ticket.seat.row ?? null,
    p_seat: ticket.seat.seat ?? null,
    p_face_value_agorot: ticket.faceValueAgorot,
  });
  if (error) {
    throw new AppError(500, 'create_listing_failed', error.message);
  }
  const rows = data as RpcRow[] | null;
  if (!rows || rows.length === 0) {
    throw new AppError(500, 'create_listing_failed', 'RPC returned no row');
  }
  const row = rows[0];

  return {
    id: row.out_listing_id,
    status: 'active',
    event: {
      name: ticket.event.name,
      date: ticket.event.date,
      venue: ticket.event.venue,
      city: ticket.event.city,
      category: ticket.event.category,
    },
    seat: {
      section: ticket.seat.section,
      row: ticket.seat.row ?? null,
      seat: ticket.seat.seat ?? null,
    },
    price: {
      faceValueAgorot: row.out_face_value_agorot,
      serviceFeeAgorot: calculateServiceFeeAgorot(row.out_face_value_agorot),
    },
    provider,
    createdAt: new Date(row.out_listing_created_at).toISOString(),
  };
};
