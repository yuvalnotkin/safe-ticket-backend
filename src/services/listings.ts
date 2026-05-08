import { supabaseAdmin } from '../utils/supabase';
import { AppError } from '../middleware/error';
import { ListingsSearchInput } from '../routes/listings.schema';
import {
  ListingResponse,
  ListingsSearchRow,
  mapRowToListing,
} from './listings.mapper';
import { resolveDateRange } from '../utils/timezone';
import { sanitizeQueryTerm } from '../utils/search';

export interface ListingsSearchResult {
  items: ListingResponse[];
  page: number;
  limit: number;
  total: number;
}

/** Applies filter predicates to a filter builder (no sort, no range). */
function buildFilteredQuery(
  input: ListingsSearchInput,
  opts: { head?: boolean } = {},
) {
  let q = supabaseAdmin
    .from('listings_search')
    .select('*', { count: 'exact', head: opts.head ?? false })
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

  if (input.q) {
    const term = sanitizeQueryTerm(input.q);
    if (term) {
      q = q.or(
        `event_title.ilike.%${term}%,venue_name.ilike.%${term}%,city.ilike.%${term}%`,
      );
    }
  }

  return q;
}

export const getListingById = async (id: string): Promise<ListingResponse> => {
  const { data, error } = await supabaseAdmin
    .from('listings_search')
    .select('*')
    .eq('listing_id', id)
    .eq('status', 'active')
    .maybeSingle();
  if (error) {
    throw new AppError(500, 'listing_query_failed', error.message);
  }
  if (!data) {
    throw new AppError(404, 'listing_not_found', 'Listing not found or not active');
  }
  return mapRowToListing(data as ListingsSearchRow);
};

export const searchListings = async (
  input: ListingsSearchInput,
): Promise<ListingsSearchResult> => {
  let q = buildFilteredQuery(input);

  switch (input.sort) {
    case 'soonest':
      q = q.order('starts_at', { ascending: true });
      break;
    case 'lowestPrice':
      q = q.order('total_price_agorot', { ascending: true });
      break;
    case 'newest':
      q = q.order('listing_created_at', { ascending: false });
      break;
  }
  // Stable pagination tiebreak — without this, rows with equal sort keys
  // can shuffle between pages on different requests.
  q = q.order('listing_id', { ascending: true });

  const offset = (input.page - 1) * input.limit;
  const { data, count, error } = await q.range(offset, offset + input.limit - 1);
  if (error) {
    // Supabase returns PGRST103 when the requested range starts beyond the
    // last row. Treat that as a valid empty page: re-run a HEAD-only count
    // with the same filters so callers get 200 + the correct total.
    if (
      error.code === 'PGRST103' ||
      (error.message && error.message.toLowerCase().includes('requested range not satisfiable'))
    ) {
      const { count: totalCount, error: countError } = await buildFilteredQuery(input, { head: true });
      if (countError) {
        throw new AppError(500, 'listings_query_failed', countError.message);
      }
      return {
        items: [],
        page: input.page,
        limit: input.limit,
        total: totalCount ?? 0,
      };
    }
    throw new AppError(500, 'listings_query_failed', error.message);
  }

  return {
    items: (data as ListingsSearchRow[]).map(mapRowToListing),
    page: input.page,
    limit: input.limit,
    total: count ?? 0,
  };
};
