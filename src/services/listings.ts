import { supabaseAdmin } from '../utils/supabase';
import { AppError } from '../middleware/error';
import { ListingsSearchInput } from '../routes/listings.schema';
import {
  ListingResponse,
  ListingsSearchRow,
  mapRowToListing,
} from './listings.mapper';

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
