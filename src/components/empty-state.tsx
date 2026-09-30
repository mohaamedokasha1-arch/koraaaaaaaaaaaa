export function EmptyState({ title, body, action }: { title: string; body?: string; action?: React.ReactNode }) {
  return (
    <div className="card flex flex-col items-center gap-2 px-6 py-12 text-center">
      <span className="crest-tile mb-1 h-16 w-16 text-navy-300">
        <svg viewBox="0 0 64 64" className="h-9 w-9 opacity-70" aria-hidden="true">
          <circle cx="32" cy="32" r="24" fill="none" stroke="currentColor" strokeWidth="3" />
          <polygon points="32,23 39.8,29.9 36.8,39.1 27.2,39.1 24.2,29.9" fill="currentColor" />
        </svg>
      </span>
      <p className="text-base font-semibold text-white">{title}</p>
      {body && <p className="max-w-md text-sm text-slate-400">{body}</p>}
      {action}
    </div>
  );
}

export function ErrorState({ title, body }: { title: string; body?: string }) {
  return (
    <div className="card flex flex-col items-center gap-2 border-red-900/60 px-6 py-12 text-center">
      <span className="mb-1 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-red-500/10 ring-1 ring-inset ring-red-500/30">
        <svg viewBox="0 0 24 24" className="h-6 w-6 text-red-300" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M12 9v4m0 4h.01M10.3 3.9 1.8 18.4A2 2 0 0 0 3.5 21.4h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      <p className="text-base font-semibold text-red-300">{title}</p>
      {body && <p className="max-w-md text-sm text-slate-400">{body}</p>}
    </div>
  );
}

export function StaleNotice({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-amber-600/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
      <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 8v4.5M12 16h.01" strokeLinecap="round" />
      </svg>
      {message}
    </div>
  );
}

export function MatchListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="space-y-2" aria-hidden="true">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="card flex items-center justify-between px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="h-4 w-24 animate-pulse rounded bg-navy-700" />
            <div className="h-6 w-6 animate-pulse rounded-full bg-navy-700" />
          </div>
          <div className="h-5 w-14 animate-pulse rounded bg-navy-700" />
          <div className="flex items-center gap-3">
            <div className="h-6 w-6 animate-pulse rounded-full bg-navy-700" />
            <div className="h-4 w-24 animate-pulse rounded bg-navy-700" />
          </div>
        </div>
      ))}
    </div>
  );
}
