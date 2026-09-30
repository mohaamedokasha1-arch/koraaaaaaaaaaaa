/**
 * Football.TXT parser (openfootball/world) — pure, alias-free.
 *
 * Documented format: `▪ Matchday N`, `  Wed Oct 30 2024`, `    17:00  Team A v Team B 1-3 (1-2)`.
 * Only structures that appear in the published files are parsed; anything
 * unrecognised is skipped rather than guessed.
 */

export const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

export interface TxtLine {
  matchday: number | null;
  date: Date;
  time: string;
  home: string;
  away: string;
  ft: [number, number];
  ht: [number, number] | null;
}

/**
 * Convert a wall-clock time in an IANA zone to a UTC instant.
 * Two passes handle DST boundaries without pulling in a date library
 * (Egypt reintroduced DST in 2023, so a fixed +02:00 would be wrong in summer).
 */
export function zonedToUtc(date: Date, time: string, timeZone: string): string {
  const [hh, mm] = time.split(':').map(Number);
  const naive = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), hh, mm);
  try {
    const dtf = new Intl.DateTimeFormat('en-US', {
      timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hour12: false,
    });
    const offsetOf = (ts: number): number => {
      const parts = dtf.formatToParts(new Date(ts));
      const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? '0');
      const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour') % 24, get('minute'));
      return asUtc - ts;
    };
    let ts = naive - offsetOf(naive);
    ts = naive - offsetOf(ts);
    return new Date(ts).toISOString();
  } catch {
    // Unknown zone (should not happen for our datasets) — keep the value honest
    // by returning the wall-clock time as UTC rather than inventing an offset.
    return new Date(naive).toISOString();
  }
}

export function parseFootballTxt(raw: string, season: string, timeZone = 'Africa/Cairo'): TxtLine[] {
  const lines = raw.split(/\r?\n/);
  const out: TxtLine[] = [];
  const startYear = Number(`20${season.slice(2, 4)}`);
  let matchday: number | null = null;
  let currentDate: Date | null = null;

  // e.g. "  Wed Oct 30 2024" — the weekday is optional, the month is what matters
  const dateRe = /^\s{2}(?:([A-Za-z]{3})\s+)?([A-Za-z]{3})\s+(\d{1,2})(?:\s+(\d{4}))?\s*$/;
  const matchRe = /^\s{4}(\d{1,2}:\d{2})\s{1,4}(.+?)\s+v\s+(.+?)\s{1,4}(\d+)-(\d+)(?:\s+\((\d+)-(\d+)\))?\s*$/;

  for (const line of lines) {
    const md = /^\s*[▪#]\s*(.+)$/.exec(line);
    if (md) {
      const n = /(\d+)/.exec(md[1]);
      matchday = n ? Number(n[1]) : null;
      continue;
    }
    const dm = dateRe.exec(line);
    if (dm) {
      const month = MONTHS[dm[2].toLowerCase()];
      const day = Number(dm[3]);
      const year = dm[4] ? Number(dm[4]) : startYear + (month >= 7 ? 0 : 1);
      if (month) currentDate = new Date(Date.UTC(year, month - 1, day));
      continue;
    }
    const mm = matchRe.exec(line);
    if (mm && currentDate) {
      const [, time, home, away, f1, f2, h1, h2] = mm;
      out.push({
        matchday,
        date: currentDate,
        time,
        home: home.trim(),
        away: away.trim(),
        ft: [Number(f1), Number(f2)],
        ht: h1 && h2 ? [Number(h1), Number(h2)] : null,
      });
    }
  }
  return out;
}

