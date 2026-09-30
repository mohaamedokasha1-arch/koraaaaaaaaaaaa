export function EmptyState({ title, body, action }: { title: string; body?: string; action?: React.ReactNode }) {
  return (
    <div className="card flex flex-col items-center gap-2 px-6 py-10 text-center">
      <svg viewBox="0 0 64 64" className="h-12 w-12 opacity-40" aria-hidden="true">
        <circle cx="32" cy="32" r="24" fill="none" stroke="currentColor" strokeWidth="3" />
        <polygon points="32,23 39.8,29.9 36.8,39.1 27.2,39.1 24.2,29.9" fill="currentColor" />
      </svg>
      <p className="text-base font-semibold text-white">{title}</p>
      {body && <p className="max-w-md text-sm text-slate-400">{body}</p>}
      {action}
    </div>
  );
}

export function ErrorState({ title, body }: { title: string; body?: string }) {
  return (
    <div className="card border-red-900/60 flex flex-col items-center gap-2 px-6 py-10 text-center">
      <p className="text-base font-semibold text-red-300">{title}</p>
      {body && <p className="max-w-md text-sm text-slate-400">{body}</p>}
    </div>
  );
}

export function StaleNotice({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-amber-600/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
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
