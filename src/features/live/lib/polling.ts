import type { SWRConfiguration } from 'swr';
import { LIVE_POLL_MS } from './config.ts';

/** refreshWhenHidden alone does not pause SWR's mount/manual/error retries. */
export function pauseLiveRefresh(): boolean {
  return typeof document !== 'undefined'
    && (document.visibilityState !== 'visible' || (typeof navigator !== 'undefined' && !navigator.onLine));
}

/** Recheck visibility/connectivity when the delayed retry actually fires. */
export const retryLiveRequest: NonNullable<SWRConfiguration['onErrorRetry']> = (_error, _key, config, revalidate, options) => {
  if (options.retryCount > (config.errorRetryCount ?? 2) || config.isPaused() || !config.isVisible() || !config.isOnline()) return;
  setTimeout(() => {
    if (!config.isPaused() && config.isVisible() && config.isOnline()) void revalidate(options);
  }, config.errorRetryInterval ?? LIVE_POLL_MS);
};
