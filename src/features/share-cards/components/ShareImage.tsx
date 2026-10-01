import type { CSSProperties } from 'react';
import { cardCopy } from '../lib/copy';
import { ogTextRuns, type ShareCardModel } from '../lib/model';
import { KORA_CARD_LOGO } from '../lib/brand';

/** ImageResponse has no true RTL word layout: explicit runs avoid word reversal. */
function ImageText({ value, style }: { value: string; style?: CSSProperties }) {
  const { rtl, parts } = ogTextRuns(value);
  return <div style={{ display: 'flex', flexDirection: rtl ? 'row-reverse' : 'row', alignItems: 'center', alignContent: 'center', justifyContent: 'center', lineHeight: 1.35, gap: 7, flexWrap: 'wrap', ...style }}>
    {parts.map((part, index) => <span key={index}>{part}</span>)}
  </div>;
}
const box = (x: number, y: number, width: number, height: number): CSSProperties => ({ position: 'absolute', left: x, top: y, width, height, display: 'flex', alignItems: 'center', justifyContent: 'center' });

/** Plain flex/absolute markup supported by next/og. No external image/font IO. */
export function ShareImage({ model }: { model: ShareCardModel }) {
  const t = cardCopy(model.locale);
  const rtl = model.locale === 'ar';
  const homeX = rtl ? 905 : 295, awayX = rtl ? 295 : 905;
  const minute = model.status === 'live' ? model.statusLabel.split(' · ')[1] : null;
  const color = model.stale ? '#fcd34d' : model.variant === 'live' ? '#fca5a5' : '#aec6e8';
  const team = (x: number, who: ShareCardModel['home'], label: string) => <div key={label} style={{ position: 'absolute', display: 'flex', left: 0, top: 0, width: 1200, height: 630 }}>
    <ImageText value={label} style={{ ...box(x - 200, 199, 400, 30), fontSize: 18, color: '#aec6e8' }} />
    <div style={{ ...box(x - 47, 235, 94, 94), borderRadius: 47, background: '#12213c', border: '2px solid #4f78b8', fontSize: 34 }}>{who.monogram}</div>
    <ImageText value={who.displayName} style={{ ...box(x - 215, 344, 430, 55), fontSize: who.displayName.length > 24 ? 23 : 28, overflow: 'hidden' }} />
  </div>;
  return <div style={{ display: 'flex', position: 'relative', width: '100%', height: '100%', background: '#070d1a', color: '#f1f5f9', fontFamily: 'CardArabic, CardLatin', fontSize: 24 }}>
    <div style={{ position: 'absolute', display: 'flex', left: 20, top: 20, width: 1160, height: 590, borderRadius: 28, border: '1px solid #23406e', background: 'linear-gradient(135deg, #12213c, #070d1a)' }} />
    {/* Exact original site icon; no third-party club artwork. */}
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img src={`data:image/svg+xml;base64,${Buffer.from(KORA_CARD_LOGO).toString('base64')}`} width={64} height={64} alt="" style={{ position: 'absolute', left: 58, top: 47 }} />
    <div style={{ ...box(137, 50, 225, 55), justifyContent: 'flex-start', fontSize: 30 }}>KoraScore</div>
    <div style={{ ...box(925, 52, 220, 44), borderRadius: 12, background: '#1a2f52', fontSize: 22, color, flexDirection: rtl ? 'row-reverse' : 'row', gap: 18 }}><ImageText value={t.statuses[model.status]} />{minute && <span>{minute}</span>}</div>
    <ImageText value={model.title} style={{ ...box(50, 109, 1100, 32), color: '#aec6e8', fontSize: 25 }} />
    <ImageText value={model.league} style={{ ...box(60, 150, 1080, 36), fontSize: 24 }} />
    {team(homeX, model.home, t.home)}{team(awayX, model.away, t.away)}
    {model.variant === 'fixture' ? <div style={{ ...box(405, 253, 390, 64), fontSize: 48 }}>{model.kickoffTime}</div> : <>
      <div style={{ ...box(rtl ? 615 : 515, 245, 70, 82), fontSize: 68 }}>{model.home.score ?? '—'}</div>
      <div style={{ ...box(580, 255, 40, 65), fontSize: 38, color: '#7ba1d4' }}>–</div>
      <div style={{ ...box(rtl ? 515 : 615, 245, 70, 82), fontSize: 68 }}>{model.away.score ?? '—'}</div>
    </>}
    {model.secondaryScore && <div style={{ ...box(60, 390, 1080, 38), flexDirection: rtl ? 'row-reverse' : 'row', gap: 12, color: '#d7e4f5', fontSize: 20 }}><ImageText value={model.secondaryScore.split(': ')[0]} /><span>{model.secondaryScore.split(': ')[1]}</span></div>}
    <ImageText value={t.kickoff} style={{ ...box(60, 432, 1080, 24), color: '#aec6e8', fontSize: 17 }} />
    <div style={{ ...box(60, 459, 1080, 29), color: '#d7e4f5', fontSize: 21 }}>{model.kickoff}</div>
    {model.stale && <ImageText value={t.stale} style={{ ...box(60, 493, 1080, 25), color: '#fcd34d', fontSize: 19 }} />}
    <div style={{ ...box(60, 530, 1080, 1), background: '#23406e' }} />
    <ImageText value={t.source} style={{ ...box(60, 543, 300, 25), color: '#aec6e8', fontSize: 17 }} />
    <div style={{ ...box(60, 571, 300, 25), fontSize: 18 }}>{model.source}</div>
    <ImageText value={t.updated} style={{ ...box(425, 543, 720, 25), color: '#aec6e8', fontSize: 17 }} />
    <div style={{ ...box(425, 571, 720, 25), fontSize: 18 }}>{model.snapshotTime}</div>
  </div>;
}
