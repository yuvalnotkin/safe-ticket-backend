import { calculateServiceFeeAgorot } from '../utils/fees';

// Shape of one row from public.listings_search (the view added in migration 0003).
export interface ListingsSearchRow {
  listing_id: string;
  status: 'active';
  listing_created_at: string;
  listing_published_at: string | null;
  ticket_id: string;
  section: string | null;
  row_label: string | null;
  seat: string | null;
  face_value_agorot: number;
  total_price_agorot: number;
  event_id: string;
  event_title: string;
  event_type: 'concert' | 'sport' | 'theater' | 'festival' | 'other';
  venue_name: string;
  city: string;
  starts_at: string;
  provider_slug: string;
}

// API_CONTRACT.md "Listing object" — what the public endpoints return.
export interface ListingResponse {
  id: string;
  status: 'active';
  event: {
    name: string;
    date: string;
    venue: string;
    city: string;
    category: 'sports' | 'culture';
  };
  seat: { section: string | null; row: string | null; seat: string | null };
  price: { faceValueAgorot: number; serviceFeeAgorot: number };
  provider: string;
  createdAt: string;
}

const toCategory = (
  t: ListingsSearchRow['event_type'],
): 'sports' | 'culture' => (t === 'sport' ? 'sports' : 'culture');

export const mapRowToListing = (r: ListingsSearchRow): ListingResponse => ({
  id: r.listing_id,
  status: r.status,
  event: {
    name: r.event_title,
    date: new Date(r.starts_at).toISOString(),
    venue: r.venue_name,
    city: r.city,
    category: toCategory(r.event_type),
  },
  seat: {
    section: r.section,
    row: r.row_label,
    seat: r.seat,
  },
  price: {
    faceValueAgorot: r.face_value_agorot,
    serviceFeeAgorot: calculateServiceFeeAgorot(r.face_value_agorot),
  },
  provider: r.provider_slug,
  createdAt: new Date(r.listing_created_at).toISOString(),
});
