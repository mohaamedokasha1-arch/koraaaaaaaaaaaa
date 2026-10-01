import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { isLocale } from '@/i18n/locales';
import { adminConfigured, isLiveAdmin } from '@/features/live/lib/admin';
import { getLiveCatalog } from '@/features/live/lib/data';
import { getLiveCopy } from '@/features/live/lib/copy';
import { signOutLiveAdmin } from '@/features/live/lib/admin-actions';
import { AdminLogin, CatalogEditor } from '@/features/live/components/AdminForms';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { robots: { index: false, follow: false }, title: 'Broadcast administration' };
export default async function LiveAdminPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params; if (!isLocale(locale) || !adminConfigured()) notFound();
  const t = getLiveCopy(locale); const authenticated = await isLiveAdmin();
  const result = authenticated ? await getLiveCatalog() : null;
  return <div className="container-page space-y-6 py-8"><div className="flex flex-wrap items-center justify-between gap-4"><h1 className="text-2xl font-bold text-white">{t.admin}</h1>{authenticated && <form action={signOutLiveAdmin}><input type="hidden" name="locale" value={locale} /><button className="btn-ghost" type="submit">{t.logout}</button></form>}</div><p className="max-w-2xl text-sm leading-7 text-slate-400">{t.adminIntro}</p>{!authenticated ? <AdminLogin locale={locale} /> : result && <>{result.stale ? <p role="alert" className="text-sm text-amber-200">{t.stale}</p> : <CatalogEditor catalog={result.catalog} locale={locale} />}</>}</div>;
}
