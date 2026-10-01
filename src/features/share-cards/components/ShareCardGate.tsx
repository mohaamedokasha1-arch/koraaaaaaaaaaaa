'use client';

import dynamic from 'next/dynamic';
import { useId, useState } from 'react';
import { cardCopy } from '../lib/copy';
import type { ShareCardModel } from '../lib/model';

const importPanel = () => import('./ShareCardPanel');
const ArPanel = dynamic(importPanel, { ssr: false, loading: () => <p role="status" className="text-sm text-slate-300">{cardCopy('ar').loading}</p> });
const EnPanel = dynamic(importPanel, { ssr: false, loading: () => <p role="status" className="text-sm text-slate-300">{cardCopy('en').loading}</p> });

/** Route-only launcher: the renderer and canvas exporter load only on intent. */
export function ShareCardGate({ model }: { model: ShareCardModel }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const t = cardCopy(model.locale);
  const Panel = model.locale === 'ar' ? ArPanel : EnPanel;
  return <section className="card min-w-0 p-4" aria-label={t.title} dir={model.locale === 'ar' ? 'rtl' : 'ltr'} data-testid="share-card-gate">
    <button type="button" aria-expanded={open} aria-controls={id} className="btn-secondary min-h-11" onClick={() => setOpen(value => !value)}>{open ? t.close : t.open}</button>
    <div id={id} hidden={!open} className={open ? 'mt-4' : ''} role="region" aria-label={t.preview}>{open && <Panel model={model} />}</div>
  </section>;
}
