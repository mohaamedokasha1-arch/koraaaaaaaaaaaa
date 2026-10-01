import type { Locale } from '@/i18n/locales';
import type { Broadcaster, Stream } from '../types/index.ts';
import { getLiveCopy } from '../lib/copy.ts';
import { LiveIcon } from './LiveIcon';
import { ExternalAdapter } from '../adapters/external';
import { officialSourceUrl } from '../adapters/urls.ts';

export function WhereToWatch({ broadcasters, externalStreams = [], locale }: { broadcasters: Broadcaster[]; externalStreams?: Stream[]; locale: Locale }) {
  const t = getLiveCopy(locale);
  const links = [
    ...broadcasters.map((item) => ({ id: item.id, name: item.name, url: item.url, region: item.region, note: item.note })),
    ...externalStreams.flatMap((stream) => {
      const url = officialSourceUrl(stream);
      return url && stream.status !== 'failed' ? [{ id: stream.id, name: stream.label, url, region: stream.region, note: '' }] : [];
    }),
  ].filter((item, index, all) => all.findIndex((candidate) => candidate.url === item.url) === index);
  return <section className="card p-5 sm:p-6" aria-label={t.where}>
    <div className="flex items-center gap-2"><LiveIcon name="tv" className="h-5 w-5 text-emerald-300" /><h2 className="text-lg font-bold text-white">{t.where}</h2></div>
    <p className="mt-2 text-xs leading-6 text-slate-400">{t.whereBody}</p>
    {links.length === 0 ? <p className="mt-4 rounded-lg bg-navy-900 p-4 text-sm text-slate-300">{t.noBroadcaster}</p> : <ul className="mt-4 space-y-3">{links.map((item) => <li key={item.id} className="rounded-lg border border-navy-700 bg-navy-900/60 p-4">
      <p className="font-semibold text-white">{item.name}</p><p className="mt-1 text-xs text-slate-400">{item.region.length ? `${t.region}: ${item.region.join(', ')}` : t.worldwide}</p>
      {item.note && <p className="mt-2 text-xs text-slate-300">{item.note}</p>}
      <ExternalAdapter url={item.url} label={t.openOfficial} />
    </li>)}</ul>}
    <p className="mt-3 text-[11px] text-slate-400">{t.subscription}</p>
  </section>;
}
