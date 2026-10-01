import type { Locale } from '@/i18n/locales';
import type { Stream } from '../types/index.ts';
import type { StreamHealth } from '../lib/fallback.ts';
import { MAX_STREAM_ATTEMPTS } from '../lib/config.ts';
import { getLiveCopy } from '../lib/copy.ts';

export function ServerSwitcher({ streams, currentId, health, attempts, onSelect, locale }: {
  streams: Stream[]; currentId: string | null; health: Record<string, StreamHealth>; attempts: Record<string, number>; onSelect: (id: string) => void; locale: Locale;
}) {
  const t = getLiveCopy(locale);
  const labels: Record<StreamHealth, string> = { unknown: t.unknown, loading: t.loading, working: t.working, slow: t.slow, failed: t.failed };
  const colors: Record<StreamHealth, string> = { unknown: 'bg-slate-500', loading: 'bg-amber-300 animate-pulse', working: 'bg-emerald-400', slow: 'bg-amber-400', failed: 'bg-red-400' };
  return <div className="space-y-3"><h2 className="text-sm font-bold text-white">{t.sources}</h2><div className="flex gap-2 overflow-x-auto pb-2" role="group" aria-label={t.sources}>
    {streams.map((stream, index) => {
      const raw = health[stream.id];
      const state: StreamHealth = raw === 'loading' || raw === 'failed' ? raw : stream.reportCount >= 3 ? 'slow' : raw === 'working' || raw === 'slow' ? raw : 'unknown';
      const active = stream.id === currentId;
      return <button key={stream.id} type="button" aria-pressed={active} disabled={!active && (attempts[stream.id] ?? 0) >= MAX_STREAM_ATTEMPTS} onClick={() => onSelect(stream.id)}
        className={`min-h-[78px] min-w-[166px] shrink-0 rounded-lg border p-3 text-start transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-300 disabled:opacity-40 ${active ? 'border-emerald-400/60 bg-emerald-400/5' : 'border-navy-600 bg-navy-900 hover:border-navy-400'}`}>
        <span className="block text-xs font-bold text-white">{t.source} {index + 1} · {stream.label}</span>
        <span className="mt-2 flex items-center gap-1.5 text-[11px] text-slate-400"><span className={`h-1.5 w-1.5 rounded-full ${colors[state]}`} aria-hidden="true" />{labels[state]}</span>
        <span className="mt-2 flex items-center gap-1.5"><span className="chip !text-[10px]">{stream.language}</span><span className="chip !text-[10px]">{stream.quality === 'auto' ? t.qualityAuto : stream.quality}</span><span className="text-[10px] text-emerald-300">{stream.isOfficial ? t.official : t.licensed}</span></span>
      </button>;
    })}
  </div></div>;
}
