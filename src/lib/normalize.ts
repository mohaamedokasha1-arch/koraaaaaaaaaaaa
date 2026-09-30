/**
 * Back-compat entry point. The implementation lives in `pure/normalize.ts`
 * (alias-free) so it can be unit-tested directly with Node's type stripping.
 */
export { normalizeText, expandQuery, matchesQuery, SEARCH_ALIASES } from './pure/normalize';
