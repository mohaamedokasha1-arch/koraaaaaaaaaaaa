import 'server-only';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ImageResponse } from 'next/og';
import { ShareImage } from '../components/ShareImage';
import { CARD_WIDTH, CARD_HEIGHT, hasOgTypography, type ShareCardModel } from './model';

// Static paths are deliberately traceable for standalone/Vercel Node functions.
let fonts: Promise<{ name: string; data: Buffer; weight: 400; style: 'normal' }[]> | undefined;
function getFonts() {
  return fonts ??= Promise.all([
    readFile(join(process.cwd(), 'src/features/share-cards/assets/Tajawal-Arabic.woff')),
    readFile(join(process.cwd(), 'src/features/share-cards/assets/Tajawal-Latin.woff')),
    readFile(join(process.cwd(), 'src/features/share-cards/assets/OFL.txt')),
  ]).then(([arabic, latin]) => [
    { name: 'CardArabic', data: arabic, weight: 400 as const, style: 'normal' as const },
    { name: 'CardLatin', data: latin, weight: 400 as const, style: 'normal' as const },
  ]);
}
const MAX_IMAGES = 32;
const MAX_INFLIGHT = 8;
const images = new Map<string, { png: Uint8Array; expires: number }>();
const inflight = new Map<string, Promise<Uint8Array>>();

export async function renderShareImage(model: ShareCardModel): Promise<Uint8Array> {
  if (!hasOgTypography(model)) throw new Error('unsupported_typography');
  const key = JSON.stringify(model);
  const cached = images.get(key);
  if (cached && Date.now() < cached.expires) return cached.png;
  if (cached) images.delete(key);
  const pending = inflight.get(key);
  if (pending) return pending;
  if (inflight.size >= MAX_INFLIGHT) throw new Error('image_busy');
  const task = (async () => {
    const response = new ImageResponse(<ShareImage model={model} />, { width: CARD_WIDTH, height: CARD_HEIGHT, fonts: await getFonts() });
    const png = new Uint8Array(await response.arrayBuffer());
    if (png.byteLength > 512_000) throw new Error('image_size');
    if (!model.stale) {
      while (images.size >= MAX_IMAGES) images.delete(images.keys().next().value!);
      images.set(key, { png, expires: Date.now() + (model.variant === 'result' ? 300_000 : 30_000) });
    }
    return png;
  })();
  inflight.set(key, task);
  try { return await task; } finally { inflight.delete(key); }
}
