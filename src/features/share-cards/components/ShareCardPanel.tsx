'use client';

import Image from 'next/image';
import { useState } from 'react';
import { cardCopy } from '../lib/copy';
import { hasOgTypography, matchShareUrl, socialShareUrls, type ShareCardModel } from '../lib/model';
import { buildCardSvg, svgDataUrl } from '../lib/svg';

export default function ShareCardPanel({ model }: { model: ShareCardModel }) {
  const t = cardCopy(model.locale);
  // Browser-facing URLs always use the actual public origin, never localhost env.
  const link = matchShareUrl(model.id, model.locale, window.location.origin);
  const svg = buildCardSvg(model, link ?? '');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [prepared, setPrepared] = useState<{ svg: string; file: File } | null>(null);
  const currentFile = prepared?.svg === svg ? prepared.file : null;
  const filename = `korascore-${model.id.replace(/[^a-z0-9]/gi, '-')}-${model.locale}-${model.variant}`;
  const social = link ? socialShareUrls(link) : null;
  const nativeAvailable = typeof navigator.share === 'function';
  const nativeFileAvailable = nativeAvailable && typeof navigator.canShare === 'function';

  async function copyLink() {
    if (!link) { setMessage(t.noLink); return; }
    try { await navigator.clipboard.writeText(link); setMessage(t.copied); } catch { setMessage(t.copyFailed); }
  }
  async function downloadSvg() {
    try {
      const { downloadBlob } = await import('../lib/export-client');
      downloadBlob(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }), `${filename}.svg`); setMessage(t.downloaded);
    } catch { setMessage(t.downloadFailed); }
  }
  async function preparePng(download: boolean) {
    setBusy(true); setMessage('');
    try {
      const { pngFromSvg, downloadBlob } = await import('../lib/export-client');
      const blob = currentFile ?? await pngFromSvg(svg);
      const file = blob instanceof File ? blob : new File([blob], `${filename}.png`, { type: 'image/png' });
      setPrepared({ svg, file });
      if (download) { downloadBlob(file, file.name); setMessage(t.downloaded); }
      else setMessage(t.imageReady);
    } catch { setMessage(t.downloadFailed); } finally { setBusy(false); }
  }
  async function nativeShare(image: boolean) {
    if (!link) { setMessage(t.noLink); return; }
    if (image && !currentFile) { await preparePng(false); return; }
    const content: ShareData = image && currentFile ? { files: [currentFile], title: model.title } : { url: link, title: `${model.home.name} — ${model.away.name} | KoraScore` };
    try {
      if (!nativeAvailable || (image && !navigator.canShare(content))) { setMessage(t.shareFailed); return; }
      // File is prepared on a previous click: retain mobile transient activation.
      await navigator.share(content); setMessage(t.shared);
    } catch (error) { setMessage(error instanceof Error && error.name === 'AbortError' ? t.cancelled : t.shareFailed); }
  }
  return <div className="space-y-4" data-testid="share-card-panel">
    <p className="text-xs leading-relaxed text-slate-300">{t.description}</p>
    {!hasOgTypography(model) && <p className="text-xs leading-relaxed text-amber-200">{t.ogFallback}</p>}
    <figure className="mx-auto max-w-4xl overflow-hidden rounded-xl border border-navy-600 bg-navy-950">
      <Image src={svgDataUrl(svg)} alt={`${model.home.name} — ${model.away.name}. ${model.scoreLabel}. ${model.statusLabel}. ${model.snapshotTime}${model.stale ? `. ${t.stale}` : ''}`} width={1200} height={630} unoptimized className="h-auto w-full" data-testid="share-card-preview" />
      <figcaption className="px-3 pb-3 text-xs leading-relaxed text-slate-300">{t.snapshot}</figcaption>
    </figure>
    <div className="flex flex-wrap gap-2">
      <button type="button" className="btn-secondary min-h-11 text-xs" disabled={busy} onClick={downloadSvg}>{t.downloadSvg}</button>
      <button type="button" className="btn-secondary min-h-11 text-xs" disabled={busy} onClick={() => preparePng(true)}>{t.downloadPng}</button>
      <button type="button" className="btn-secondary min-h-11 text-xs" disabled={!link} onClick={copyLink}>{t.copy}</button>
      {nativeAvailable && <button type="button" className="btn-secondary min-h-11 text-xs" disabled={busy || !link} onClick={() => nativeShare(false)}>{t.shareLink}</button>}
      {nativeFileAvailable && <button type="button" className="btn-secondary min-h-11 text-xs" disabled={busy || !link} onClick={() => nativeShare(true)}>{currentFile ? t.shareImage : t.prepareImage}</button>}
      {social && <>
        <a className="btn-secondary min-h-11 text-xs" href={social.facebook} target="_blank" rel="noopener noreferrer">{t.facebook}</a>
        <a className="btn-secondary min-h-11 text-xs" href={social.x} target="_blank" rel="noopener noreferrer">{t.x}</a>
      </>}
    </div>
    {link && <label className="block text-xs text-slate-300">{t.copy}<input type="url" readOnly value={link} dir="ltr" className="mt-2 w-full rounded-lg border border-navy-600 bg-navy-950 px-3 py-2 text-xs text-slate-100" onFocus={(event) => event.currentTarget.select()} /></label>}
    <p role="status" aria-live="polite" className="min-h-5 text-xs text-navy-100">{busy ? t.busy : message}</p>
  </div>;
}
