'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Re-renders data-backed server components at a gentle interval while visible.
 * The server cache still controls upstream API traffic; this only asks the
 * server for a fresh page payload. When a tab returns to the foreground, it
 * refreshes immediately rather than leaving results frozen in a background tab.
 */
export function AutoRefresh({ intervalMs = 60_000 }: { intervalMs?: number }) {
  const router = useRouter();

  useEffect(() => {
    let lastRefreshAt = Date.now();

    const refreshIfVisible = () => {
      if (document.visibilityState !== 'visible') return;
      // Debounce visibility-change + interval events that land together.
      if (Date.now() - lastRefreshAt < Math.min(intervalMs, 10_000)) return;
      lastRefreshAt = Date.now();
      router.refresh();
    };

    const timer = window.setInterval(refreshIfVisible, intervalMs);
    document.addEventListener('visibilitychange', refreshIfVisible);

    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', refreshIfVisible);
    };
  }, [intervalMs, router]);

  return null;
}
