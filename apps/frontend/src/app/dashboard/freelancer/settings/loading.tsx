export default function SettingsLoading() {
  return (
    <main className="p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-5xl animate-pulse space-y-6">
        <div className="h-8 w-52 rounded bg-muted" />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="h-52 rounded-xl bg-muted lg:col-span-2" />
          <div className="h-52 rounded-xl bg-muted" />
          <div className="h-52 rounded-xl bg-muted" />
          <div className="h-52 rounded-xl bg-muted lg:col-span-2" />
        </div>
      </div>
    </main>
  );
}
