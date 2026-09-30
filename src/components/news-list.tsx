import type { NewsItem } from '@/lib/types';
import type { Dictionary } from '@/i18n/dictionaries';
import type { Locale } from '@/i18n/locales';

function formatDate(iso: string | null, locale: Locale): string | null {
  if (!iso) return null;
  try {
    return new Intl.DateTimeFormat(locale === 'ar' ? 'ar-EG' : 'en-GB', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: process.env.NEXT_PUBLIC_DEFAULT_TIMEZONE ?? 'Africa/Cairo',
    }).format(new Date(iso));
  } catch {
    return null;
  }
}

/**
 * Presentational news list. Headline + short excerpt + credit + link out —
 * never the full article, always a visible source name next to the headline.
 */
export function NewsList({
  items,
  locale,
  dict,
  compact = false,
}: {
  items: NewsItem[];
  locale: Locale;
  dict: Dictionary;
  compact?: boolean;
}) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {items.map((item) => {
        const date = formatDate(item.publishedAt, locale);
        return (
          <li key={item.id}>
            <article className="card card-hover flex h-full flex-col gap-2 px-4 py-4">
              <div className="flex items-center gap-2 text-[11px] uppercase tracking-wide text-slate-500">
                <span className="chip !text-[11px]">{item.source}</span>
                {date && (
                  <time dateTime={item.publishedAt ?? undefined} className="tabular-nums">
                    {date}
                  </time>
                )}
              </div>
              <h3 className={compact ? 'text-sm font-bold leading-snug text-white' : 'text-base font-bold leading-snug text-white'}>
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer external"
                  className="transition-colors hover:text-navy-200"
                >
                  {item.title}
                </a>
              </h3>
              {!compact && item.excerpt && (
                <p className="text-sm leading-relaxed text-slate-400">{item.excerpt}</p>
              )}
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer external"
                className="link-accent mt-auto text-xs font-semibold"
              >
                {dict.news.readAtSource.replace('{source}', item.source)}
              </a>
            </article>
          </li>
        );
      })}
    </ul>
  );
}

/** Visible attribution block — required by the feeds we support. */
export function NewsAttribution({ sources, locale }: { sources: { name: string; url: string }[]; locale: Locale }) {
  if (sources.length === 0) return null;
  return (
    <p className="text-xs leading-relaxed text-slate-500">
      {locale === 'ar' ? 'العناوين من: ' : 'Headlines from: '}
      {sources.map((s, i) => (
        <span key={s.url}>
          {i > 0 && ' · '}
          <a href={s.url} target="_blank" rel="noopener noreferrer external" className="link-accent font-semibold">
            {s.name}
          </a>
        </span>
      ))}
    </p>
  );
}
