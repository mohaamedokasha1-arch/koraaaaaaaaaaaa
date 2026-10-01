'use client';

import { useEffect, useState } from 'react';
import { resolveTimeZone, TIMEZONE_COOKIE } from '@/lib/pure/time';

/** Hydrate the site's existing zone cookie without making broadcast pages SSR. */
export function useLiveTimezone(): string {
  const [zone, setZone] = useState(resolveTimeZone(null));
  useEffect(() => {
    const sync = () => {
      try {
        const cookie = document.cookie.split('; ').find((entry) => entry.startsWith(`${TIMEZONE_COOKIE}=`));
        setZone(resolveTimeZone(cookie ? decodeURIComponent(cookie.slice(TIMEZONE_COOKIE.length + 1)) : null));
      } catch { setZone(resolveTimeZone(null)); }
    };
    sync(); window.addEventListener('kora:timezone-change', sync);
    return () => window.removeEventListener('kora:timezone-change', sync);
  }, []);
  return zone;
}
