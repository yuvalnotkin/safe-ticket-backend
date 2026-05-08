import { fromZonedTime } from 'date-fns-tz';
import { addDays, parseISO, format } from 'date-fns';

const TZ = 'Asia/Jerusalem';

export interface ResolvedDateRange {
  /** UTC ISO timestamp of start-of-day (Asia/Jerusalem) for dateFrom, inclusive. */
  dateFromUtc?: string;
  /** UTC ISO timestamp of start-of-NEXT-day (Asia/Jerusalem) for dateTo, exclusive. */
  dateToUtcExclusive?: string;
}

/**
 * Convert YYYY-MM-DD calendar dates (Asia/Jerusalem time) into UTC ISO bounds
 * suitable for `starts_at >= from` and `starts_at < toExclusive` queries.
 *
 * dateFrom and dateTo are both inclusive in the contract; we convert dateTo
 * to next-day-exclusive internally so the underlying SQL uses a half-open
 * interval (cleaner than `<=` against an end-of-day timestamp).
 */
export const resolveDateRange = (
  dateFrom: string | undefined,
  dateTo: string | undefined,
): ResolvedDateRange => {
  const out: ResolvedDateRange = {};
  if (dateFrom) {
    out.dateFromUtc = fromZonedTime(`${dateFrom}T00:00:00`, TZ).toISOString();
  }
  if (dateTo) {
    const nextDay = format(addDays(parseISO(dateTo), 1), 'yyyy-MM-dd');
    out.dateToUtcExclusive = fromZonedTime(`${nextDay}T00:00:00`, TZ).toISOString();
  }
  return out;
};
