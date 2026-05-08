import { supabaseAdmin } from '../utils/supabase';
import { AppError } from '../middleware/error';
import { ListingsSearchInput } from '../routes/listings.schema';
import {
  ListingResponse,
  ListingsSearchRow,
  mapRowToListing,
} from './listings.mapper';
import { resolveDateRange } from '../utils/timezone';

export interface ListingsSearchResult {
  items: ListingResponse[];
  page: number;
  limit: number;
  total: number;
}

export const searchListings = async (
  input: ListingsSearchInput,
): Promise<ListingsSearchResult> => {
  let q = supabaseAdmin
    .from('listings_search')
    .select('*', { count: 'exact' })
    .eq('status', 'active');

  if (input.category === 'sports') {
    q = q.eq('event_type', 'sport');
  } else if (input.category === 'culture') {
    q = q.in('event_type', ['concert', 'theater', 'festival', 'other']);
  }

  if (input.cities && input.cities.length) {
    q = q.in('city', input.cities);
  }

  if (input.providers && input.providers.length) {
    q = q.in('provider_slug', input.providers);
  }

  const { dateFromUtc, dateToUtcExclusive } = resolveDateRange(input.dateFrom, input.dateTo);
  if (dateFromUtc) {
    q = q.gte('starts_at', dateFromUtc);
  }
  if (dateToUtcExclusive) {
    q = q.lt('starts_at', dateToUtcExclusive);
  }

  if (input.minPriceAgorot != null) {
    q = q.gte('total_price_agorot', input.minPriceAgorot);
  }
  if (input.maxPriceAgorot != null) {
    q = q.lte('total_price_agorot', input.maxPriceAgorot);
  }

  // Default sort (T6) — additional sorts come in T10.
  q = q.order('starts_at', { ascending: true });
  // Stable pagination tiebreak — without this, rows with equal sort keys
  // can shuffle between pages on different requests.
  q = q.order('listing_id', { ascending: true });

  const offset = (input.page - 1) * input.limit;
  const { data, count, error } = await q.range(offset, offset + input.limit - 1);
  if (error) {
    throw new AppError(500, 'listings_query_failed', error.message);
  }

  return {
    items: (data as ListingsSearchRow[]).map(mapRowToListing),
    page: input.page,
    limit: input.limit,
    total: count ?? 0,
  };
};
