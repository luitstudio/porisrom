export default function CompanySettingsLoading() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="h-8 w-72 rounded bg-muted" />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="h-52 rounded-xl bg-muted lg:col-span-2" />
        <div className="h-52 rounded-xl bg-muted" />
        <div className="h-52 rounded-xl bg-muted" />
        <div className="h-52 rounded-xl bg-muted lg:col-span-2" />
      </div>
    </div>
  );
}
