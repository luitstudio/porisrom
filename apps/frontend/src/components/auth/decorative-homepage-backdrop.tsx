export function DecorativeHomepageBackdrop() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 hidden overflow-hidden bg-linear-to-b from-peach via-white to-lavender select-none sm:block"
    >
      {/* faux navbar */}
      <div className="mx-auto mt-5 flex w-[92%] max-w-6xl items-center justify-between rounded-2xl border border-border bg-card px-5 py-3 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="size-6 rounded-lg bg-primary" />
          <span className="h-3 w-20 rounded-full bg-foreground/15" />
        </div>
        <div className="hidden items-center gap-4 md:flex">
          <span className="h-2.5 w-14 rounded-full bg-foreground/10" />
          <span className="h-2.5 w-14 rounded-full bg-foreground/10" />
          <span className="h-2.5 w-14 rounded-full bg-foreground/10" />
        </div>
        <span className="h-8 w-24 rounded-full bg-primary/30" />
      </div>

      {/* faux hero */}
      <div className="mx-auto mt-16 flex w-[92%] max-w-3xl flex-col items-center gap-4">
        <span className="h-7 w-3/4 rounded-full bg-foreground/15" />
        <span className="h-7 w-1/2 rounded-full bg-primary/25" />
        <span className="mt-2 h-12 w-full max-w-md rounded-full bg-card shadow-sm" />
        <div className="mt-3 flex gap-2">
          <span className="h-7 w-20 rounded-full bg-card shadow-sm" />
          <span className="h-7 w-24 rounded-full bg-card shadow-sm" />
          <span className="h-7 w-20 rounded-full bg-card shadow-sm" />
        </div>
      </div>

      {/* faux category cards */}
      <div className="mx-auto mt-16 grid w-[92%] max-w-4xl grid-cols-2 gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <span key={i} className="h-28 rounded-2xl bg-card shadow-sm" />
        ))}
      </div>
    </div>
  );
}
