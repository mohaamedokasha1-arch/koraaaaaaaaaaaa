import type { Locale } from '@/i18n/locales';
import { getLiveCopy } from '../lib/copy.ts';
import { LiveIcon } from './LiveIcon';

const platforms = [
  { name: 'beIN SPORTS', url: 'https://www.beinsports.com/', initials: 'beIN' },
  { name: 'TOD', url: 'https://www.tod.tv/', initials: 'TOD' },
  { name: 'DAZN', url: 'https://www.dazn.com/', initials: 'DAZN' },
  { name: 'FIFA+', url: 'https://www.plus.fifa.com/', initials: 'FIFA+' },
];
export function OfficialPlatforms({ locale }: { locale: Locale }) {
  const t = getLiveCopy(locale);
  return <section className="card p-5 sm:p-6" aria-labelledby="official-platforms">
    <div className="mb-3 flex items-center gap-2 text-emerald-300"><LiveIcon name="shield" /><h2 id="official-platforms" className="font-bold text-white">{t.platforms}</h2></div>
    <p className="text-xs leading-6 text-slate-400">{t.platformsBody}</p>
    <ul className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
      {platforms.map((platform) => <li key={platform.url}><a href={platform.url} target="_blank" rel="noopener noreferrer" className="flex min-h-[64px] items-center gap-3 rounded-lg border border-navy-700 bg-navy-900/70 p-3 transition-colors hover:border-navy-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-300">
        <span className="inline-flex h-10 w-14 shrink-0 items-center justify-center rounded-md bg-navy-800 text-[11px] font-black tracking-wide text-white" dir="ltr">{platform.initials}</span>
        <span className="text-sm font-semibold text-white" dir="ltr">{platform.name}</span><LiveIcon name="external" className="ms-auto h-4 w-4 text-slate-400" />
      </a></li>)}
    </ul>
  </section>;
}
