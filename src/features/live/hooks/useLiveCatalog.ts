'use client';

import { useEffect, useState } from 'react';
import useSWR from 'swr';
import { catalogRowsSchema, liveCatalogSchema, type LiveCatalog } from '../types/index.ts';
import { LIVE_ENABLED, LIVE_POLL_MS, publicLiveStore } from '../lib/config.ts';

const store = publicLiveStore();
const url = store ? `${store.url}/rest/v1/live_catalog?id=eq.primary&select=document` : '/live/catalog.json';

async function fetchCatalog(): Promise<LiveCatalog> {
  const response = await fetch(url, {
    headers: store ? { apikey: store.anonKey, Authorization: `Bearer ${store.anonKey}` } : undefined,
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error('Catalog unavailable');
  const body: unknown = await response.json();
  if (!store) return liveCatalogSchema.parse(body);
  const rows = catalogRowsSchema.parse(body);
  if (!rows[0]) throw new Error('Catalog not published');
  return rows[0].document;
}

/** CDN JSON or RLS-protected anon reads. No new read Route Handler. */
export function useLiveCatalog(initial: LiveCatalog, initialStale = false) {
  const [refreshed, setRefreshed] = useState(false);
  const result = useSWR<LiveCatalog>(LIVE_ENABLED ? ['live-catalog', url] : null, fetchCatalog, {
    fallbackData: initial,
    refreshInterval: LIVE_POLL_MS,
    refreshWhenHidden: false,
    refreshWhenOffline: false,
    revalidateOnFocus: false,
    revalidateOnReconnect: true,
    dedupingInterval: 10_000,
    errorRetryInterval: LIVE_POLL_MS,
    errorRetryCount: 2,
    keepPreviousData: true,
    onSuccess: () => setRefreshed(true),
  });
  const { mutate } = result;
  useEffect(() => {
    const visible = () => { if (LIVE_ENABLED && document.visibilityState === 'visible') void mutate(); };
    document.addEventListener('visibilitychange', visible);
    return () => document.removeEventListener('visibilitychange', visible);
  }, [mutate]);
  return { catalog: result.data ?? initial, stale: Boolean(result.error) || (initialStale && !refreshed) };
}
