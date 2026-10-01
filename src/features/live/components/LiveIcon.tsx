export function LiveIcon({ name, className = 'h-5 w-5' }: {
  name: 'play' | 'tv' | 'shield' | 'arrow' | 'external' | 'calendar' | 'refresh' | 'fullscreen' | 'report' | 'check';
  className?: string;
}) {
  const paths = {
    play: 'm9 5 11 7-11 7V5Z', tv: 'M4 7h16v13H4V7Zm4-5 4 5 4-5M9 23h6',
    shield: 'M12 3 3 7v5c0 5 9 9 9 9s9-4 9-9V7l-9-4Zm-4 9 3 3 5-6',
    arrow: 'M5 12h14m-6-6 6 6-6 6', external: 'M14 3h7v7m0-7L10 14M10 3H4v17h17v-6',
    calendar: 'M8 2v4m8-4v4M3 9h18M5 5h14v16H5V5Zm3 8h3m2 0h3m-8 4h3',
    refresh: 'M21 12a9 9 0 1 1-2.6-6.4M21 3v6h-6',
    fullscreen: 'M8 3H3v5m13-5h5v5M3 16v5h5m8 0h5v-5',
    report: 'M12 8v5m0 4h.01M12 3 2 21h20L12 3Z', check: 'm5 12 4 4L19 6',
  };
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true"><path d={paths[name]} /></svg>;
}
