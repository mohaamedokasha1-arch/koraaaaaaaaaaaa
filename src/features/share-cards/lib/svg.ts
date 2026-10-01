import { cardCopy } from './copy.ts';
import { CARD_WIDTH, CARD_HEIGHT, textDirection, type ShareCardModel } from './model.ts';
import { KORA_CARD_LOGO } from './brand.ts';

export function escapeXml(text: string): string {
  return text.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[char]!);
}
export function svgDataUrl(svg: string): string { return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`; }

/** Standalone, bounded, text-only SVG. No external images/fonts, script or foreignObject. */
export function buildCardSvg(model: ShareCardModel, link = ''): string {
  const t = cardCopy(model.locale);
  const rtl = model.locale === 'ar';
  const homeX = rtl ? 905 : 295, awayX = rtl ? 295 : 905;
  const color = model.stale ? '#fcd34d' : model.variant === 'live' ? '#fca5a5' : '#aec6e8';
  const text = (x: number, y: number, value: string, size = 24, fill = '#f1f5f9', extra = '') => `<text x="${x}" y="${y}" font-size="${size}" fill="${fill}" text-anchor="middle" direction="${textDirection(value)}" unicode-bidi="plaintext" ${extra}>${escapeXml(value)}</text>`;
  const team = (x: number, who: ShareCardModel['home'], label: string, clip: string) => `
    ${text(x, 220, label, 18, '#aec6e8')}
    <circle cx="${x}" cy="282" r="47" fill="#12213c" stroke="#4f78b8" stroke-width="2"/>
    ${text(x, 295, who.monogram, 32)}
    <g clip-path="url(#${clip})">${text(x, 371, who.displayName, Array.from(who.displayName).length > 24 ? 23 : 28)}</g>`;
  const main = model.variant === 'fixture'
    ? text(600, 305, model.kickoffTime, 48, '#fff', 'font-weight="700"')
    : `${text(rtl ? 650 : 550, 315, `${model.home.score ?? '—'}`, 66, '#fff', 'font-weight="800"')}${text(600, 312, '–', 38, '#7ba1d4')}${text(rtl ? 550 : 650, 315, `${model.away.score ?? '—'}`, 66, '#fff', 'font-weight="800"')}`;
  const minute = model.status === 'live' ? model.statusLabel.split(' · ')[1] : null;
  const badge = minute ? `${text(rtl ? 1080 : 980, 81, t.statuses[model.status], 21, color)}${text(rtl ? 980 : 1080, 81, minute, 21, color)}` : text(1035, 81, model.statusLabel, 22, color);
  const secondary = model.secondaryScore?.split(': ');
  const logo = KORA_CARD_LOGO.replace('<svg ', '<svg x="58" y="47" ');
  const description = `${model.scoreLabel}. ${t.source}: ${model.source}. ${t.updated}: ${model.snapshotTime}. ${t.snapshot}${link ? ` ${link}` : ''}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${CARD_WIDTH}" height="${CARD_HEIGHT}" viewBox="0 0 ${CARD_WIDTH} ${CARD_HEIGHT}" role="img" aria-labelledby="title desc">
<title id="title">${escapeXml(`${model.title} — ${model.home.name} / ${model.away.name}`)}</title><desc id="desc">${escapeXml(description)}</desc>
<defs><linearGradient id="card-bg" x1="0" x2="1" y1="0" y2="1"><stop stop-color="#12213c"/><stop offset="1" stop-color="#070d1a"/></linearGradient><clipPath id="home-name"><rect x="${homeX - 215}" y="341" width="430" height="55"/></clipPath><clipPath id="away-name"><rect x="${awayX - 215}" y="341" width="430" height="55"/></clipPath></defs>
<rect width="1200" height="630" fill="#070d1a"/><rect x="20" y="20" width="1160" height="590" rx="28" fill="url(#card-bg)" stroke="#23406e"/>
<g fill="none" stroke="#23406e" opacity=".3"><path d="M600 194v211M48 200h1104v202H48z"/><circle cx="600" cy="301" r="90"/></g>
${logo}
<g font-family="system-ui, -apple-system, 'Segoe UI', Arial, sans-serif">
<text x="137" y="91" font-size="30" font-weight="800" fill="#fff">KoraScore</text>
<rect x="925" y="52" width="220" height="44" rx="12" fill="#1a2f52"/>
${badge}
${text(600, 133, model.title, 25, '#aec6e8')}
${text(600, 169, model.league, 24)}
${team(homeX, model.home, t.home, 'home-name')}${team(awayX, model.away, t.away, 'away-name')}
${main}
${secondary ? `${text(rtl ? 665 : 535, 411, secondary[0], 20, '#d7e4f5')}${text(rtl ? 535 : 665, 411, secondary[1], 20, '#d7e4f5')}` : ''}
${text(600, 440, t.kickoff, 17, '#aec6e8')}
${text(600, 475, model.kickoff, 21, '#d7e4f5')}
${model.stale ? text(600, 504, t.stale, 19, '#fcd34d') : ''}
<path d="M60 530h1080" stroke="#23406e"/>
${text(210, 555, t.source, 17, '#aec6e8')}${text(210, 585, model.source, 18, '#d7e4f5')}
${text(785, 555, t.updated, 17, '#aec6e8')}${text(785, 585, model.snapshotTime, 18, '#d7e4f5')}
</g></svg>`;
}
