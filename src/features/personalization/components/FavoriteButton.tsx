'use client';

import { useState } from 'react';
import type { Locale } from '@/i18n/locales';
import { favoriteLabel, hasFavorite, type Favorite } from '../lib/preferences';
import { getPersonalCopy } from '../lib/copy';
import { preferencesStore, usePreferences } from '../hooks/usePreferences';

export function FavoriteButton({ favorite, locale, compact = true }: {
  favorite: Favorite; locale: Locale; compact?: boolean;
}) {
  const snapshot = usePreferences();
  const [message, setMessage] = useState('');
  const t = getPersonalCopy(locale);
  const active = hasFavorite(snapshot.preferences, favorite);
  const label = `${active ? t.unfollow : t.follow} ${favoriteLabel(favorite, locale)}`;
  return (
    <>
      <button
        type="button"
        aria-pressed={active}
        aria-label={label}
        title={label}
        disabled={!snapshot.ready || snapshot.persistence === 'unsupported'}
        onClick={() => {
          const result = preferencesStore.toggle(favorite);
          setMessage(result.error ? t[result.error === 'unsupported' ? 'storageUnsupported' : result.error] : result.persisted ? '' : t.temporary);
        }}
        className={`inline-flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center gap-2 rounded-lg border px-2.5 text-xs font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#fbdf9b] disabled:opacity-40 ${
          active ? 'border-[#d9a93f]/50 bg-[#d9a93f]/10 text-[#fbdf9b] hover:bg-[#d9a93f]/20' : 'border-navy-700/70 bg-navy-900/50 text-slate-400 hover:border-navy-400 hover:text-white'
        }`}
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
          <path d="m12 3 2.8 5.7 6.3.9-4.6 4.5 1.1 6.3-5.6-3-5.6 3 1.1-6.3L2.9 9.6l6.3-.9L12 3Z" strokeLinejoin="round" />
        </svg>
        {!compact && <span>{active ? t.following : t.follow}</span>}
      </button>
      {message && (
        <div role="status" className="fixed inset-x-4 bottom-4 z-50 mx-auto flex max-w-lg items-center gap-3 rounded-xl border border-amber-400/30 bg-navy-900 px-4 py-3 text-sm leading-6 text-amber-200 shadow-lift">
          <span className="flex-1">{message}</span>
          <button type="button" onClick={() => setMessage('')} className="btn-ghost !px-3" aria-label={locale === 'ar' ? 'إغلاق الرسالة' : 'Dismiss message'}>×</button>
        </div>
      )}
    </>
  );
}
