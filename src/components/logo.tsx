/**
 * KoraScore brand mark.
 *
 * A club-style shield (the universal football symbol) in the site's navy,
 * outlined in trophy gold, carrying a champion star and a clean match ball.
 * Pure SVG with self-contained gradient ids, so it scales cleanly from the
 * 16px favicon to hero size without looking generic.
 *
 * The wordmark next to it lives in the header/footer and is unchanged.
 */
export function Logo({ className = 'h-8 w-8' }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} role="img" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="ks-shield" x1="0" y1="0" x2="0.3" y2="1">
          <stop offset="0" stopColor="#1d3b6b" />
          <stop offset="0.55" stopColor="#122340" />
          <stop offset="1" stopColor="#070d19" />
        </linearGradient>
        <linearGradient id="ks-rim" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fbdf9b" />
          <stop offset="0.45" stopColor="#d9a93f" />
          <stop offset="1" stopColor="#8f6318" />
        </linearGradient>
        <linearGradient id="ks-star" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffe6a8" />
          <stop offset="1" stopColor="#d09a2c" />
        </linearGradient>
        <radialGradient id="ks-glow" cx="0.5" cy="0.62" r="0.55">
          <stop offset="0" stopColor="#2f5391" stopOpacity="0.55" />
          <stop offset="1" stopColor="#2f5391" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* shield */}
      <path
        d="M32 3.4 57.4 11.4v20.8c0 13.4-10.4 23.9-25.4 28.7C17 56.1 6.6 45.6 6.6 32.2V11.4L32 3.4Z"
        fill="url(#ks-shield)"
      />
      <ellipse cx="32" cy="36" rx="20" ry="18" fill="url(#ks-glow)" />
      <path
        d="M32 3.4 57.4 11.4v20.8c0 13.4-10.4 23.9-25.4 28.7C17 56.1 6.6 45.6 6.6 32.2V11.4L32 3.4Z"
        fill="none"
        stroke="url(#ks-rim)"
        strokeWidth="2.4"
      />

      {/* champion star */}
      <path
        d="M32 10.6 33.5 14.3 37.5 14.5 34.4 16.9 35.4 20.8 32 18.6 28.6 20.8 29.6 16.9 26.5 14.5 30.5 14.3Z"
        fill="url(#ks-star)"
      />

      {/* match ball */}
      <circle cx="32" cy="36.4" r="14.2" fill="#f7fafd" />
      <circle cx="32" cy="36.4" r="14.2" fill="none" stroke="#c3d2e6" strokeWidth="0.9" />
      <polygon points="32,29.6 38.2,34.1 35.8,41.4 28.2,41.4 25.8,34.1" fill="#101f3a" />
      <g stroke="#101f3a" strokeWidth="2.2" strokeLinecap="round">
        <line x1="32" y1="29.6" x2="32" y2="22.4" />
        <line x1="38.2" y1="34.1" x2="45" y2="31.9" />
        <line x1="35.8" y1="41.4" x2="39.6" y2="47.6" />
        <line x1="28.2" y1="41.4" x2="24.4" y2="47.6" />
        <line x1="25.8" y1="34.1" x2="19" y2="31.9" />
      </g>
    </svg>
  );
}
