'use client';

import type { FormEvent } from 'react';
import type { Locale } from '@/i18n/locales';
import { getLiveCopy } from '../lib/copy.ts';

export function RightsForm({ locale, contact }: { locale: Locale; contact: string | null }) {
  const t = getLiveCopy(locale);
  if (!contact) return <p role="status" className="rounded-lg border border-amber-700/40 bg-amber-950/20 p-4 text-sm text-amber-200">{t.contactMissing}</p>;
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const data = new FormData(event.currentTarget);
    const body = ['name', 'email', 'url', 'message'].map((field) => `${field}: ${data.get(field) ?? ''}`).join('\n\n');
    window.location.href = `mailto:${contact}?subject=${encodeURIComponent('KoraScore rights concern')}&body=${encodeURIComponent(body)}`;
  }
  const input = 'mt-2 min-h-[44px] w-full rounded-lg border border-navy-600 bg-navy-900 px-3 py-2 text-sm text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300';
  return <form onSubmit={submit} className="space-y-4"><label className="block text-sm text-slate-300">{t.name}<input name="name" required maxLength={180} autoComplete="name" className={input} /></label><label className="block text-sm text-slate-300">{t.email}<input name="email" type="email" required maxLength={254} autoComplete="email" dir="ltr" className={input} /></label><label className="block text-sm text-slate-300">{t.pageUrl}<input name="url" type="url" required maxLength={2048} dir="ltr" className={input} /></label><label className="block text-sm text-slate-300">{t.message}<textarea name="message" required minLength={20} maxLength={5000} rows={5} className={input} /></label><button type="submit" className="btn-primary">{t.sendEmail}</button><a href={`mailto:${contact}`} className="ms-3 text-xs text-slate-400" dir="ltr">{contact}</a></form>;
}
