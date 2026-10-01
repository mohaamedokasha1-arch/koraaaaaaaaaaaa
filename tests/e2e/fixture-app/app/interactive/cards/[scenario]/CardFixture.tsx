'use client';

import { useState } from 'react';
import { ShareCardGate } from '../../../../../../../src/features/share-cards/components/ShareCardGate';
import { buildShareCard } from '../../../../../../../src/features/share-cards/lib/model';
import { cardSnapshot } from '../../card-data';

export default function CardFixture({ scenario }: { scenario: string }) {
  const [fresh, setFresh] = useState(false);
  const locale = scenario.startsWith('ar') ? 'ar' : 'en';
  const model = buildShareCard(cardSnapshot(scenario, fresh), locale)!;
  return <div dir={locale === 'ar' ? 'rtl' : 'ltr'} className="space-y-5">
    <p className="text-sm text-amber-200">Isolated browser-test application — synthetic source snapshots, never production football data.</p>
    <h1 className="text-xl font-bold">Share-card source contract</h1>
    <button type="button" className="btn-secondary" onClick={() => setFresh(true)}>Supply fresh score</button>
    <ShareCardGate model={model} />
  </div>;
}
