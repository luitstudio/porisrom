"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { removeReview } from "./actions";

export function RemoveReviewButton({ reviewId }: { reviewId: string }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function handleRemove() {
    if (!window.confirm("Remove this review? This permanently removes it and recalculates the profile rating.")) return;
    setError(null);
    startTransition(async () => {
      const result = await removeReview(reviewId);
      if (!result.ok) setError(result.error);
      else router.replace("/reviews?moderated=removed");
    });
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <button
        type="button"
        disabled={isPending}
        onClick={handleRemove}
        className="min-h-11 rounded-md px-4 py-2 font-medium disabled:opacity-50"
        style={{ border: "1px solid var(--danger)", color: "var(--danger)" }}
      >
        {isPending ? "Removing…" : "Remove review"}
      </button>
      {error && <p role="alert" className="max-w-xs text-sm" style={{ color: "var(--danger)" }}>{error}</p>}
    </div>
  );
}
