export default function PortfolioLoading() {
  return (
    <main className="p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-5xl animate-pulse space-y-6">
        <div className="h-8 w-44 rounded bg-muted" />
        <div className="h-48 rounded-xl bg-muted" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="h-36 rounded-xl bg-muted" />
          <div className="h-36 rounded-xl bg-muted" />
        </div>
      </div>
    </main>
  );
}
