import type { Metadata } from 'next';
import MatchPage, { generateMetadata as matchMetadata } from '../../../../../../../src/app/[locale]/matches/[id]/page';
import { cache, CACHE_TTL } from '../../../../../../../src/lib/cache';
import { cardSnapshot } from '../../card-data';
import type { Locale } from '../../../../../../../src/i18n/locales';

// Real production page/metadata, TEST PROCESS ONLY. No fake-source flag in src/app.
function seed(scenario: string) {
  const locale: Locale = scenario.startsWith('ar') ? 'ar' : 'en';
  const value = cardSnapshot(scenario).data;
  const id = 'fd~990002';
  const match = { ...value, id, home: { ...value.home, crest: null }, league: { ...value.league, emblem: null } };
  if (scenario.includes('unsafe')) match.home.name = '</script><script>globalThis.fixtureInjected = true</script>';
  cache.set(`match:${id}`, match, CACHE_TTL.MATCH_DETAIL);
  return { locale, id };
}
export async function generateMetadata({ params }: { params: Promise<{ scenario: string }> }): Promise<Metadata> {
  const source = seed((await params).scenario);
  const metadata = await matchMetadata({ params: Promise.resolve(source) });
  return { ...metadata, robots: { index: false, follow: false } }; // never index test data
}
export default async function FullMatchFixture({ params }: { params: Promise<{ scenario: string }> }) {
  const source = seed((await params).scenario);
  return <div lang={source.locale} dir={source.locale === 'ar' ? 'rtl' : 'ltr'}>
    <p className="text-sm text-amber-200">ISOLATED TEST APPLICATION: production match page with a synthetic test-process cache snapshot. Never production football data.</p>
    {await MatchPage({ params: Promise.resolve(source) })}
  </div>;
}
