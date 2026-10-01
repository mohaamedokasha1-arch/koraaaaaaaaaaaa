'use client';

import { useState } from 'react';
import type { Locale } from '@/i18n/locales';
import { LIVE_ENABLED } from '../lib/config.ts';
import { getLiveCopy } from '../lib/copy.ts';
import { LiveIcon } from './LiveIcon';

export function ReportButton({ matchId, streamId, locale }: { matchId: string; streamId: string; locale: Locale }) {
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'unavailable' | 'rate' | 'error'>('idle');
  const t = getLiveCopy(locale);
  const messages = { unavailable: t.reportUnavailable, rate: t.reportRate, error: t.reportError };
  async function report() {
    if (!LIVE_ENABLED || state === 'sending' || state === 'done') return;
    setState('sending');
    try {
      const response = await fetch('/api/live/report', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ matchId, streamId }), signal: AbortSignal.timeout(8000) });
      if (response.status === 503) setState('unavailable');
      else if (response.status === 429) setState('rate');
      else if (!response.ok) setState('error');
      else setState('done');
    } catch { setState('error'); }
  }
  return <div><button type="button" className="btn-ghost !text-xs" onClick={report} disabled={state === 'sending' || state === 'done'}><LiveIcon name={state === 'done' ? 'check' : 'report'} className="h-4 w-4" />{state === 'sending' ? t.reporting : state === 'done' ? t.reported : t.report}</button>
    <p role="status" className="mt-2 max-w-md text-xs text-amber-200">{state === 'unavailable' || state === 'rate' || state === 'error' ? messages[state] : ''}</p>
  </div>;
}
