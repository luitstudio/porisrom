import { backendFetch } from "@/lib/backend-api";
import { requireSession } from "@/lib/session";

import { RemoveReviewButton } from "./remove-review-button";

type Identity = {
  id: string;
  name: string;
  role: string | null;
  freelancerProfile?: { id: string } | null;
  companyProfile?: { id: string; companyName: string } | null;
};
type AdminReview = {
  id: string;
  rating: number;
  comment: string | null;
  direction: string;
  createdAt: string;
  author: Identity;
  target: Identity;
  workAssignment: { id: string; title: string };
};

export default async function ReviewsPage({ searchParams }: { searchParams: Promise<{ moderated?: string }> }) {
  const { moderated } = await searchParams;
  const { accessToken } = await requireSession();
  const reviews = await backendFetch<AdminReview[]>("/admin/reviews", { accessToken });

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-4">
      <div><h1 className="text-xl font-semibold">Review moderation</h1><p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>Inspect public reviews and remove abusive, private, or inappropriate content.</p></div>
      {moderated === "removed" && <p role="status" className="card border-emerald-600 p-4 text-sm text-emerald-700">Review removed and profile rating updated.</p>}
      {reviews.length === 0 ? (
        <section className="card p-6 text-sm" style={{ color: "var(--muted)" }}>No reviews to moderate.</section>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {reviews.map((review) => (
            <article key={review.id} className="card min-w-0 p-4 sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div><p className="font-semibold">{review.rating}/5 stars</p><p className="text-xs" style={{ color: "var(--muted)" }}>{new Date(review.createdAt).toLocaleDateString("en-IN")}</p></div>
                <span className="rounded-full px-3 py-1 text-xs" style={{ border: "1px solid var(--border)" }}>{review.direction.replaceAll("_", " ")}</span>
              </div>
              <p className="my-4 whitespace-pre-wrap break-words">{review.comment || "No written comment."}</p>
              <dl className="mb-4 grid gap-3 text-sm sm:grid-cols-2">
                <div><dt style={{ color: "var(--muted)" }}>Reviewer</dt><dd className="break-words font-medium">{review.author.name} ({review.author.role ?? "unknown"})</dd></div>
                <div><dt style={{ color: "var(--muted)" }}>Reviewed profile</dt><dd className="break-words font-medium">{review.target.companyProfile?.companyName || review.target.name} ({review.target.role ?? "unknown"})</dd></div>
                <div className="sm:col-span-2"><dt style={{ color: "var(--muted)" }}>Assignment</dt><dd className="break-words">{review.workAssignment.title}</dd></div>
              </dl>
              <RemoveReviewButton reviewId={review.id} />
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
