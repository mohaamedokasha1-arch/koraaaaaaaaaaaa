import type { Metadata } from 'next';
import Link from 'next/link';
import '@/app/globals.css';
import { getDictionary } from '@/i18n/dictionaries';
import { Header } from '@/components/header';
import { Footer } from '@/components/footer';

/**
 * Root 404.
 *
 * Next serves this file for every URL that matches no route. It renders on the
 * SERVER (unlike the not-found boundary inside `[locale]`, which Next streams
 * as RSC payload and paints on the client), so a crawler — and a visitor with
 * JavaScript disabled — gets a real page with a real 404 status instead of an
 * empty shell. That is what keeps unknown URLs out of "Soft 404".
 *
 * The locale layout does not wrap this file, so header/footer and the global
 * stylesheet are pulled in here explicitly. The copy is bilingual and the
 * links point at the Arabic default; the localized 404 for URLs under
 * /ar and /en stays in `src/app/[locale]/not-found.tsx`.
 */
export const metadata: Metadata = {
  title: 'الصفحة غير موجودة | KoraScore',
  robots: { index: false, follow: true },
};

export default function RootNotFound() {
  const dict = getDictionary('ar');

  return (
    <>
      <Header locale="ar" dict={dict} />
      <main id="main" className="container-page flex flex-col items-center gap-4 py-24 text-center">
        <p className="text-6xl font-extrabold tracking-tight text-navy-400" aria-hidden="true">
          404
        </p>
        <span aria-hidden="true" className="hairline-gold w-24" />
        <h1 className="text-lg font-semibold text-white">الصفحة غير موجودة</h1>
        <p className="max-w-md text-sm text-slate-400">
          This page could not be found. / هذه الصفحة غير متاحة.
        </p>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
          <Link href="/ar" className="btn-primary">
            {dict.nav.home}
          </Link>
          <Link href="/ar/live" className="btn-ghost">
            {dict.nav.live}
          </Link>
          <Link href="/ar/leagues" className="btn-ghost">
            {dict.nav.leagues}
          </Link>
        </div>
      </main>
      <Footer locale="ar" dict={dict} />
    </>
  );
}
