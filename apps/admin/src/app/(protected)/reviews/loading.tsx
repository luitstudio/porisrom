export default function ReviewsLoading() {
  return <div className="flex flex-col gap-4" aria-label="Loading reviews"><div className="h-8 w-52 animate-pulse rounded bg-slate-300/40" /><div className="grid gap-4 lg:grid-cols-2">{[0, 1, 2, 3].map(item => <div key={item} className="card h-56 animate-pulse bg-slate-300/20" />)}</div></div>;
}
