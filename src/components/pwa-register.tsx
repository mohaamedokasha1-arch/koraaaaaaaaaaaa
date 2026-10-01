'use client';

import { useEffect } from 'react';

/**
 * Registers the service worker.
 *
 * Kept intentionally tiny and side-effect-free for the app: it registers
 * `/sw.js` once the page is idle, and never interacts with data fetching. The
 * SW itself only caches immutably-versioned assets and an offline fallback page
 * (see public/sw.js) — never API responses, never rendered scoreboards.
 */
export function PwaRegister() {
  useEffect(() => {
    const nav = navigator as Navigator & { serviceWorker?: ServiceWorkerContainer };
    if (!nav.serviceWorker) return;
    const secure =
      window.location.protocol === 'https:' || window.location.hostname === 'localhost';
    if (!secure) return;

    const register = () => {
      nav.serviceWorker?.register('/sw.js', { scope: '/' }).catch(() => {
        // Registration failure must never affect the page.
      });
    };

    const win = window as Window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
      cancelIdleCallback?: (handle: number) => void;
    };

    if (typeof win.requestIdleCallback === 'function') {
      const handle = win.requestIdleCallback(register, { timeout: 3000 });
      return () => win.cancelIdleCallback?.(handle);
    }
    const timer = window.setTimeout(register, 2500);
    return () => window.clearTimeout(timer);
  }, []);

  return null;
}
