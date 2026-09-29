"use client";

export default function ReviewsError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <section className="card flex flex-col items-start gap-3 p-6"><h1 className="text-xl font-semibold">Reviews could not be loaded</h1><p style={{ color: "var(--muted)" }}>Please try again. No moderation action was performed.</p><button type="button" onClick={reset} className="min-h-11 rounded-md px-4 py-2 font-medium" style={{ border: "1px solid var(--border)" }}>Retry</button></section>;
}
