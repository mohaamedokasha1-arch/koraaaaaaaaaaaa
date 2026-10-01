'use client';

import Link from 'next/link';
import { Suspense, useState } from 'react';
import type { Locale } from '@/i18n/locales';
import { TeamLogo } from '@/components/team-logo';
import { TimezoneSelect } from '@/components/timezone-select';
import { LangSwitcher } from '@/components/lang-switcher';
import { foldText } from '@/lib/pure/entity';
import { num } from '@/lib/format';
import { favoriteHref, favoriteLabel, type FavoriteCatalog, type FavoriteKind } from '../lib/preferences';
import { getPersonalCopy } from '../lib/copy';
import { preferencesStore, usePreferences } from '../hooks/usePreferences';
import { FavoriteButton } from './FavoriteButton';
import { StorageNotice } from './StorageNotice';

const KINDS: FavoriteKind[] = ['team', 'league', 'player'];
const PAGE_SIZE = 12;

export function ProfileClient({ locale, catalog, tz }: { locale: Locale; catalog: FavoriteCatalog; tz: string }) {
  const snapshot = usePreferences();
  const t = getPersonalCopy(locale);
  const [kind, setKind] = useState<FavoriteKind>('team');
  const [query, setQuery] = useState('');
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [expanded, setExpanded] = useState<FavoriteKind[]>([]);
  const [confirmClear, setConfirmClear] = useState(false);
  const [message, setMessage] = useState('');
  const needle = foldText(query);
  const options = catalog[kind].filter((option) => !needle || option.searchTerms.some((term) => foldText(term).includes(needle)));
  const editable = snapshot.ready && snapshot.persistence !== 'unsupported';
  function chooseKind(next: FavoriteKind, focus = false) {
    setKind(next); setQuery(''); setVisible(PAGE_SIZE);
    if (focus) document.getElementById(`catalog-tab-${next}`)?.focus();
  }

  return (
    <div className="space-y-6">
      <StorageNotice persistence={snapshot.persistence} locale={locale} />
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-6">
          <section className="card p-5 sm:p-6" aria-labelledby="interests-heading">
            <div className="mb-5 flex items-center justify-between gap-3">
              <h2 id="interests-heading" className="section-title">{t.favorites}</h2>
              <span className="chip tabular-nums" aria-label={`${t.favorites}: ${snapshot.preferences.favorites.length}`}>{num(snapshot.preferences.favorites.length, locale)}</span>
            </div>
            {!snapshot.ready ? <p role="status" className="text-sm text-slate-400">{t.loading}</p> : snapshot.preferences.favorites.length === 0 ? (
              <div className="rounded-xl border border-dashed border-navy-600/70 bg-navy-900/35 px-5 py-8 text-center">
                <span aria-hidden="true" className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-[#d9a93f]/30 bg-[#d9a93f]/5 text-2xl text-[#fbdf9b]">☆</span>
                <h3 className="text-base font-bold text-white">{t.emptyTitle}</h3>
                <p className="mx-auto mt-2 max-w-md text-sm leading-7 text-slate-400">{t.emptyBody}</p>
                <a href="#interest-catalog" className="btn-primary mt-5 text-xs">{t.explore}</a>
              </div>
            ) : (
              <div className="space-y-6">
                {KINDS.map((groupKind) => {
                  const favorites = snapshot.preferences.favorites.filter((favorite) => favorite.kind === groupKind);
                  if (favorites.length === 0) return null;
                  const list = expanded.includes(groupKind) ? favorites : favorites.slice(0, 6);
                  return (
                    <section key={groupKind} aria-label={t[groupKind]}>
                      <h3 className="mb-3 text-xs font-bold text-slate-400">{t[groupKind]} <span className="ms-1 tabular-nums text-slate-500">{num(favorites.length, locale)}</span></h3>
                      <ul className="grid gap-2 sm:grid-cols-2">
                        {list.map((favorite) => (
                          <li key={favorite.id} className="flex min-w-0 items-center gap-3 rounded-lg border border-navy-700/50 bg-navy-900/45 p-3">
                            <TeamLogo src={favorite.crest} alt={favorite.kind === 'player' ? favorite.teamName ?? '' : favoriteLabel(favorite, locale)} size={30} />
                            <Link href={favoriteHref(favorite, locale)} prefetch={false} className="min-w-0 flex-1 py-1" title={t.viewSource}>
                              <span className="block truncate text-sm font-semibold text-white hover:text-navy-200">{favoriteLabel(favorite, locale)}</span>
                              {(favorite.teamName || favorite.country) && <span className="mt-1 block truncate text-[11px] text-slate-500">{favorite.teamName ?? favorite.country}</span>}
                            </Link>
                            <FavoriteButton favorite={favorite} locale={locale} />
                          </li>
                        ))}
                      </ul>
                      {list.length < favorites.length && <button type="button" className="btn-ghost mt-3 text-xs" onClick={() => setExpanded((current) => [...current, groupKind])}>{t.showMore} ({num(favorites.length - list.length, locale)})</button>}
                    </section>
                  );
                })}
                <Link href={`/${locale}`} prefetch={false} className="btn-primary text-xs">{t.dashboard} <span aria-hidden="true">↗</span></Link>
              </div>
            )}
          </section>

          <section id="interest-catalog" className="card scroll-mt-24 p-5 sm:p-6" aria-labelledby="catalog-heading">
            <h2 id="catalog-heading" className="section-title">{t.catalog}</h2>
            <p className="mt-3 text-sm leading-7 text-slate-400">{t.catalogIntro}</p>
            <div className="mt-5 flex gap-1.5 border-b border-navy-700/60 pb-4" role="tablist" aria-label={t.catalog}>
              {KINDS.map((tabKind, index) => (
                <button
                  key={tabKind} type="button" role="tab" id={`catalog-tab-${tabKind}`}
                  aria-controls="catalog-panel" aria-selected={kind === tabKind} tabIndex={kind === tabKind ? 0 : -1}
                  onClick={() => chooseKind(tabKind)}
                  onKeyDown={(event) => {
                    const direction = event.key === 'ArrowRight' ? (locale === 'ar' ? -1 : 1) : event.key === 'ArrowLeft' ? (locale === 'ar' ? 1 : -1) : 0;
                    if (direction || event.key === 'Home' || event.key === 'End') {
                      event.preventDefault();
                      chooseKind(KINDS[event.key === 'Home' ? 0 : event.key === 'End' ? KINDS.length - 1 : (index + direction + KINDS.length) % KINDS.length], true);
                    }
                  }}
                  className={`tab-btn ${kind === tabKind ? 'tab-btn-active' : ''}`}
                >{t[tabKind]}</button>
              ))}
            </div>
            <div role="tabpanel" id="catalog-panel" aria-labelledby={`catalog-tab-${kind}`} className="mt-4">
              <label className="block text-xs font-semibold text-slate-400" htmlFor="catalog-search">{t.filter}</label>
              <input
                id="catalog-search" type="search" maxLength={60} autoComplete="off" value={query}
                placeholder={t.filterPlaceholder}
                onChange={(event) => { setQuery(event.target.value); setVisible(PAGE_SIZE); }}
                className="mt-2 min-h-[44px] w-full rounded-lg border border-navy-600 bg-navy-900 px-3 text-sm text-white placeholder:text-slate-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-navy-300"
              />
              {kind === 'player' && <p className="mt-4 text-xs leading-7 text-slate-400">{t.playersUnavailable}</p>}
              <p role="status" className="sr-only">{num(options.length, locale)} {t[kind]}</p>
              {options.length === 0 ? <p className="mt-4 rounded-lg bg-navy-900/50 p-4 text-sm leading-7 text-slate-400">{t.noOptions}</p> : (
                <ul className="mt-4 grid gap-2 sm:grid-cols-2">
                  {options.slice(0, visible).map(({ favorite }) => (
                    <li key={favorite.id} className="flex min-w-0 items-center gap-3 rounded-lg border border-navy-700/50 p-3 transition-colors hover:bg-navy-800/40">
                      <TeamLogo src={favorite.crest} alt={favorite.kind === 'player' ? favorite.teamName ?? '' : favoriteLabel(favorite, locale)} size={30} />
                      <div className="min-w-0 flex-1">
                        <Link href={favoriteHref(favorite, locale)} prefetch={false} className="block truncate py-1 text-sm font-semibold text-slate-200 hover:text-white" title={t.viewSource}>{favoriteLabel(favorite, locale)}</Link>
                        {(favorite.teamName || favorite.country) && <span className="block truncate text-[11px] text-slate-500">{favorite.teamName ?? favorite.country}</span>}
                      </div>
                      <FavoriteButton favorite={favorite} locale={locale} />
                    </li>
                  ))}
                </ul>
              )}
              {options.length > visible && <button type="button" className="btn-ghost mt-4 text-xs" onClick={() => setVisible((current) => current + PAGE_SIZE)}>{t.showMore}</button>}
              <Link href={`/${locale}/search`} prefetch={false} className="link-accent mt-4 block min-h-[44px] py-3 text-xs font-semibold">{locale === 'ar' ? 'المزيد من الفرق والكيانات في البحث العام' : 'Find more teams and entities in public search'} ↗</Link>
            </div>
          </section>
        </div>

        <aside className="space-y-5" aria-label={t.settings}>
          <section className="card p-5" aria-labelledby="settings-heading">
            <h2 id="settings-heading" className="section-title !text-base">{t.settings}</h2>
            <div className="mt-5 space-y-5 divide-y divide-navy-700/60">
              <div>
                <label className="flex cursor-pointer items-center justify-between gap-3 text-sm font-semibold text-slate-200">
                  <span>{t.dashboardSetting}</span>
                  <input type="checkbox" checked={snapshot.preferences.dashboardEnabled} disabled={!editable} onChange={(event) => { const result = preferencesStore.setDashboardEnabled(event.target.checked); setMessage(result.error ? t[result.error === 'unsupported' ? 'storageUnsupported' : result.error] : result.persisted ? '' : t.temporary); }} className="h-5 w-5 shrink-0 accent-[#d9a93f] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#fbdf9b]" />
                </label>
                <p className="mt-2 text-xs leading-7 text-slate-500">{t.dashboardHint}</p>
              </div>
              <div className="pt-5">
                <p className="mb-3 text-xs font-semibold text-slate-400">{t.timezone}</p>
                <TimezoneSelect current={tz} locale={locale} />
                <p className="mt-2 text-xs leading-7 text-slate-500">{t.timezoneHint}</p>
              </div>
              <div className="flex items-center justify-between gap-3 pt-5">
                <div><p className="text-xs font-semibold text-slate-400">{t.language}</p><p className="mt-1 text-sm text-slate-200">{locale === 'ar' ? 'العربية' : 'English'}</p></div>
                <Suspense fallback={null}><LangSwitcher locale={locale} /></Suspense>
              </div>
            </div>
          </section>
          <section className="card p-5" aria-labelledby="privacy-heading">
            <span aria-hidden="true" className="mb-3 inline-flex rounded-lg border border-navy-600 bg-navy-900 p-2 text-navy-300"><svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M12 3 4 6v6c0 5 8 9 8 9s8-4 8-9V6l-8-3Z" /><path d="m8.5 12 2.5 2.5 4.5-5" /></svg></span>
            <h2 id="privacy-heading" className="text-sm font-bold text-white">{t.privacy}</h2>
            <p className="mt-3 text-xs leading-7 text-slate-400">{t.privacyIntro}</p>
            <p className="mt-3 text-xs leading-7 text-slate-500">{t.accountsDeferred}</p>
            <Link href={`/${locale}/privacy`} prefetch={false} className="link-accent mt-3 inline-block min-h-[44px] py-3 text-xs font-semibold">{t.privacyLink} ↗</Link>
            <div className="mt-3 border-t border-navy-700/60 pt-4">
              {!confirmClear ? <button type="button" disabled={!snapshot.ready} className="btn-ghost w-full text-xs disabled:opacity-40" onClick={() => { setConfirmClear(true); setMessage(''); }}>{t.clear}</button> : (
                <div className="space-y-3">
                  <p className="text-xs leading-7 text-amber-200">{t.confirmClear}</p>
                  <button type="button" className="btn-ghost w-full !border-red-400/40 !text-red-200 text-xs" onClick={() => { const result = preferencesStore.clear(); setConfirmClear(false); setMessage(result.persisted ? t.cleared : t.storageMemory); }}>{t.confirm}</button>
                  <button type="button" className="btn-ghost w-full text-xs" onClick={() => setConfirmClear(false)}>{t.cancel}</button>
                </div>
              )}
              <p role="status" className="mt-3 text-xs leading-7 text-slate-400">{message}</p>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
