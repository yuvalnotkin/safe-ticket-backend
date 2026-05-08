const MAX_TERM_LENGTH = 80;

/**
 * Sanitize a user-supplied search term for safe interpolation into a Supabase
 * `.or(...)` filter string with `ilike` patterns.
 *
 * - Strips: , ( ) " ' \ — these would corrupt the `.or()` parser or escape sequences.
 * - Escapes: % _ — these are LIKE wildcards; we want literal matches only.
 * - Trims and length-caps to defend against pathological input.
 *
 * Returns a string safe to embed inside `column.ilike.%${term}%` patterns.
 * Empty result (after sanitization) is possible — caller should treat empty
 * as "no q filter" (the route schema already trims and rejects empty strings,
 * so in practice this only happens for input that was entirely strip-worthy).
 */
export const sanitizeQueryTerm = (raw: string): string => {
  const stripped = raw.replace(/[,()"'\\]/g, '');
  const escaped = stripped.replace(/[%_]/g, (m) => `\\${m}`);
  return escaped.trim().slice(0, MAX_TERM_LENGTH);
};
