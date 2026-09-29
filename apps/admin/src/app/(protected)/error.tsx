"use client";

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <section className="admin-panel admin-dashboard-error" role="alert"><p className="admin-eyebrow">Dashboard unavailable</p><h1>We couldn&apos;t load the latest operations data.</h1><p>Please try again. No marketplace data was changed.</p><button type="button" onClick={reset}>Retry</button></section>;
}
