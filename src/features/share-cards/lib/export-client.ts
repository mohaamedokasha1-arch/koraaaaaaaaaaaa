import { CARD_WIDTH, CARD_HEIGHT } from './model';

/** Only imported after an explicit export action. No upstream/API/third-party IO. */
export function downloadBlob(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url; anchor.download = name; anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  try { anchor.click(); } finally {
    anchor.remove();
    // Safari/download agents may consume the blob asynchronously.
    window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
  }
}
export async function pngFromSvg(svg: string): Promise<Blob> {
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));
  try {
    const image = new Image();
    await new Promise<void>((resolve, reject) => {
      const timer = window.setTimeout(() => { reject(new Error('image_timeout')); image.src = ''; }, 10_000);
      image.onload = () => { window.clearTimeout(timer); resolve(); };
      image.onerror = () => { window.clearTimeout(timer); reject(new Error('image_decode')); };
      image.src = url;
    });
    const canvas = document.createElement('canvas');
    canvas.width = CARD_WIDTH; canvas.height = CARD_HEIGHT;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('canvas_unavailable');
    context.drawImage(image, 0, 0, CARD_WIDTH, CARD_HEIGHT);
    return await new Promise<Blob>((resolve, reject) => {
      const timer = window.setTimeout(() => reject(new Error('png_timeout')), 10_000);
      canvas.toBlob(blob => { window.clearTimeout(timer); blob ? resolve(blob) : reject(new Error('png_unavailable')); }, 'image/png');
    });
  } finally { URL.revokeObjectURL(url); }
}
