import 'server-only';
import bundledCatalog from '../../../../public/live/catalog.json';
import { catalogRowsSchema, emptyCatalog, liveCatalogSchema, type LiveCatalog } from '../types/index.ts';
import { LIVE_ENABLED, publicLiveStore } from './config.ts';

export interface CatalogResult { catalog: LiveCatalog; stale: boolean; source: 'json' | 'supabase' }

/** Read-only ISR; never fetches a score provider or a video during a build. */
export async function getLiveCatalog(): Promise<CatalogResult> {
  const parsed = liveCatalogSchema.safeParse(bundledCatalog);
  const fallback = parsed.success ? parsed.data : emptyCatalog();
  if (!LIVE_ENABLED) return { catalog: emptyCatalog(), stale: false, source: 'json' };
  const store = publicLiveStore();
  if (!store) return { catalog: fallback, stale: !parsed.success, source: 'json' };
  try {
    const response = await fetch(`${store.url}/rest/v1/live_catalog?id=eq.primary&select=document`, {
      headers: { apikey: store.anonKey, Authorization: `Bearer ${store.anonKey}` },
      next: { revalidate: 60, tags: ['live-catalog'] },
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) throw new Error('Catalog unavailable');
    const rows = catalogRowsSchema.parse(await response.json());
    if (!rows[0]) throw new Error('No catalog published');
    return { catalog: rows[0].document, stale: false, source: 'supabase' };
  } catch {
    // A malformed/outage response must not take down the site or leak credentials.
    return { catalog: fallback, stale: true, source: 'json' };
  }
}
