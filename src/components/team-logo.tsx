'use client';

import { useState } from 'react';

/**
 * Crest image with graceful fallback to a monogram tile when the image
 * is missing or fails to load (never shows a broken image icon).
 */
export function TeamLogo({
  src,
  alt,
  size = 24,
  className = '',
}: {
  src: string | null | undefined;
  alt: string;
  size?: number;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const dim = { width: size, height: size };

  if (!src || failed) {
    return (
      <span
        aria-hidden={alt ? undefined : true}
        role={alt ? 'img' : undefined}
        aria-label={alt || undefined}
        style={{ ...dim, fontSize: Math.max(9, size * 0.42) }}
        className={`inline-flex items-center justify-center rounded-full bg-navy-700 font-bold text-slate-200 shrink-0 ${className}`}
      >
        {(alt || '?').trim().charAt(0).toUpperCase()}
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      {...dim}
      loading="lazy"
      onError={() => setFailed(true)}
      className={`inline-block shrink-0 object-contain ${className}`}
    />
  );
}
