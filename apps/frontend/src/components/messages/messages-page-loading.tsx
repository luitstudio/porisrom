export function MessagesPageLoading({ padded = false }: { padded?: boolean }) {
  return (
    <div className={padded ? "space-y-6 px-4 py-6 sm:px-6 lg:px-10 lg:py-10" : "space-y-6"}>
      <div className="h-8 w-40 animate-pulse rounded bg-muted" />
      <div className="h-64 animate-pulse rounded-xl bg-muted" />
      <div className="space-y-2">
        <div className="h-20 animate-pulse rounded-xl bg-muted" />
        <div className="h-20 animate-pulse rounded-xl bg-muted" />
      </div>
      <span className="sr-only" role="status">Loading messages and connection requests.</span>
    </div>
  );
}
