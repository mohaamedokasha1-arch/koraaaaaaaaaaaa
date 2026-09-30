export function Logo({ className = 'h-8 w-8' }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <circle cx="32" cy="32" r="24" fill="#fff" />
      <circle cx="32" cy="32" r="24" fill="none" stroke="#12213c" strokeWidth="3" />
      <polygon points="32,23 39.8,29.9 36.8,39.1 27.2,39.1 24.2,29.9" fill="#12213c" />
      <g stroke="#12213c" strokeWidth="3">
        <line x1="32" y1="23" x2="32" y2="13" />
        <line x1="39.8" y1="29.9" x2="49" y2="27.2" />
        <line x1="36.8" y1="39.1" x2="43" y2="46.5" />
        <line x1="27.2" y1="39.1" x2="21" y2="46.5" />
        <line x1="24.2" y1="29.9" x2="15" y2="27.2" />
      </g>
    </svg>
  );
}
