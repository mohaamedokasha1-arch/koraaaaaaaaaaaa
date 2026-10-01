'use client';

import { useActionState, useEffect, useState } from 'react';
import type { Locale } from '@/i18n/locales';
import type { LiveCatalog } from '../types/index.ts';
import { getLiveCopy } from '../lib/copy.ts';
import { saveLiveCatalog, signInLiveAdmin, type AdminActionState } from '../lib/admin-actions';

const initial: AdminActionState = { status: 'idle' };
export function AdminLogin({ locale }: { locale: Locale }) {
  const [state, action, pending] = useActionState(signInLiveAdmin, initial);
  const t = getLiveCopy(locale);
  return <form action={action} className="card max-w-md space-y-5 p-6"><input type="hidden" name="locale" value={locale} /><label className="block text-sm text-slate-300">{t.password}<input type="password" name="password" autoComplete="current-password" required maxLength={512} className="mt-2 min-h-[44px] w-full rounded-lg border border-navy-600 bg-navy-900 px-3 text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300" /></label><button type="submit" disabled={pending} className="btn-primary disabled:opacity-50">{t.login}</button><p role="status" className="text-sm text-amber-200">{state.status === 'error' ? t.invalidLogin : ''}</p></form>;
}
export function CatalogEditor({ catalog, locale }: { catalog: LiveCatalog; locale: Locale }) {
  const [document, setDocument] = useState(JSON.stringify(catalog, null, 2));
  const [state, action, pending] = useActionState(saveLiveCatalog, initial);
  const t = getLiveCopy(locale);
  useEffect(() => { if (state.catalog) setDocument(JSON.stringify(state.catalog, null, 2)); }, [state.catalog]);
  function download() {
    const url = URL.createObjectURL(new Blob([document], { type: 'application/json' }));
    const anchor = window.document.createElement('a'); anchor.href = url; anchor.download = 'catalog.json'; anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return <form action={action} className="card space-y-5 p-5"><label className="block text-sm text-slate-300">{t.document}<textarea name="document" value={document} onChange={(event) => setDocument(event.target.value)} spellCheck={false} dir="ltr" rows={26} disabled={pending} required className="mt-3 w-full rounded-lg border border-navy-600 bg-navy-950 p-4 font-mono text-xs leading-6 text-slate-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300" /></label><div className="flex flex-wrap gap-3"><button type="submit" disabled={pending} className="btn-primary disabled:opacity-50">{pending ? t.saving : t.save}</button><button type="button" onClick={download} className="btn-ghost">{t.download}</button></div><div role="status"><p className={`text-sm ${state.status === 'saved' ? 'text-emerald-300' : 'text-amber-200'}`}>{state.status === 'saved' ? t.saved : state.status === 'error' ? state.issues?.length ? t.invalidDocument : t.saveFailed : ''}</p>{state.issues && <ul className="mt-3 space-y-2 font-mono text-xs text-amber-200" dir="ltr">{state.issues.map((issue, index) => <li key={index}>{issue}</li>)}</ul>}</div></form>;
}
