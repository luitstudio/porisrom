export default function FreelancerDashboardLoading() {
  return (
    <main
      className="overflow-x-clip px-3 py-5 min-[375px]:px-4 sm:px-6 sm:py-6 lg:px-10 lg:py-10"
      aria-label="Loading freelancer dashboard"
      aria-busy="true"
    >
      <div className="mx-auto flex w-full max-w-7xl min-w-0 animate-pulse flex-col gap-5 sm:gap-6">
        <div className="space-y-2">
          <div className="h-7 w-52 max-w-[75%] rounded-lg bg-muted sm:h-9 sm:w-64" />
          <div className="h-4 w-full max-w-md rounded bg-muted" />
        </div>

        <div className="rounded-2xl border border-border bg-card p-4 min-[375px]:p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="h-4 w-36 rounded bg-muted" />
            <div className="h-4 w-24 rounded bg-muted" />
          </div>
          <div className="mt-3 h-2 w-full rounded-full bg-muted" />
          <div className="mt-4 h-11 w-full rounded-lg bg-muted sm:ml-auto sm:w-36" />
        </div>

        <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:gap-6">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="min-h-48 rounded-xl border border-border bg-card p-4"
            >
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
      </div>
    </main>
  );
}
