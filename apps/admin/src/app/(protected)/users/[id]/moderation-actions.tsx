"use client";

import { useState, useTransition } from "react";

import { approveUser, rejectUser, reviewIdentityDocument } from "../actions";

export function ModerationActions({ userId, status, identityDocumentStatus }: { userId: string; status: string; identityDocumentStatus?: string }) {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function run(action: "approve" | "reject") {
    const verb = action === "approve" ? "approve" : "reject";
    if (!window.confirm(`Are you sure you want to ${verb} this profile?`)) return;
    setMessage(null);
    startTransition(async () => {
      const result = action === "approve" ? await approveUser(userId) : await rejectUser(userId);
      setMessage(result.ok ? `Profile ${action === "approve" ? "approved" : "rejected"} successfully.` : result.error);
    });
  }

  function reviewDocument(nextStatus: "approved" | "rejected") {
    if (!window.confirm(`Are you sure you want to mark this identity document as ${nextStatus === "approved" ? "reviewed" : "rejected"}?`)) return;
    setMessage(null);
    startTransition(async () => {
      const result = await reviewIdentityDocument(userId, nextStatus);
      setMessage(result.ok ? `Identity document ${nextStatus === "approved" ? "reviewed" : "rejected"}.` : result.error);
    });
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      {status !== "approved" && (
        <button type="button" disabled={isPending} onClick={() => run("approve")} className="min-h-11 rounded-md bg-emerald-600 px-5 py-2 font-medium text-white disabled:opacity-50">
          {isPending ? "Updating…" : "Approve"}
        </button>
      )}
      {status !== "rejected" && (
        <button type="button" disabled={isPending} onClick={() => run("reject")} className="min-h-11 rounded-md px-5 py-2 font-medium disabled:opacity-50" style={{ border: "1px solid var(--danger)", color: "var(--danger)" }}>
          {isPending ? "Updating…" : "Reject"}
        </button>
      )}
      {message && <p role="status" className="text-sm" style={{ color: "var(--muted)" }}>{message}</p>}
      {identityDocumentStatus && (
        <div className="flex flex-wrap gap-2">
          {identityDocumentStatus !== "approved" && <button type="button" disabled={isPending} onClick={() => reviewDocument("approved")} className="min-h-11 rounded-md bg-emerald-600 px-5 py-2 font-medium text-white disabled:opacity-50">Mark identity reviewed</button>}
          {identityDocumentStatus !== "rejected" && <button type="button" disabled={isPending} onClick={() => reviewDocument("rejected")} className="min-h-11 rounded-md px-5 py-2 font-medium disabled:opacity-50" style={{ border: "1px solid var(--danger)", color: "var(--danger)" }}>Reject identity document</button>}
        </div>
      )}
    </div>
  );
}
