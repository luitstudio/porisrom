export default function ClientDashboardLoading() {
  return (
    <div
      className="flex min-w-0 animate-pulse flex-col gap-5 sm:gap-6"
      aria-label="Loading client dashboard"
      aria-busy="true"
    >
      <div className="space-y-2">
        <div className="h-7 w-60 max-w-[80%] rounded-lg bg-muted sm:h-9 sm:w-72" />
        <div className="h-4 w-full max-w-sm rounded bg-muted" />
      </div>

      <div className="rounded-2xl border border-border bg-card p-4 min-[375px]:p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="h-4 w-36 rounded bg-muted" />
          <div className="h-4 w-24 rounded bg-muted" />
        </div>
        <div className="mt-3 h-2 w-full rounded-full bg-muted" />
        <div className="mt-4 h-11 w-full rounded-lg bg-muted sm:ml-auto sm:w-36" />
      </div>

      <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="min-h-48 rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-3">
              <div className="size-10 shrink-0 rounded-xl bg-muted" />
              <div className="h-5 w-36 max-w-[60%] rounded bg-muted" />
            </div>
            <div className="mt-5 space-y-2">
              <div className="h-4 w-full rounded bg-muted" />
              <div className="h-4 w-4/5 rounded bg-muted" />
            </div>
            <div className="mt-5 h-11 w-32 rounded-lg bg-muted" />
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-border bg-card p-4 min-[375px]:p-5 sm:p-6">
        <div className="h-4 w-24 rounded bg-muted" />
        <div className="mt-5 space-y-4">
          <div className="h-4 w-full rounded bg-muted" />
          <div className="h-4 w-full rounded bg-muted" />
          <div className="h-4 w-3/4 rounded bg-muted" />
        </div>
      </div>
    </div>
  );
}
