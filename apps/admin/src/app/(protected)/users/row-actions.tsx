"use client";

import { useTransition } from "react";

import { approveUser, rejectUser, setBadge, setBlocked, softDeleteUser } from "./actions";

type Props = {
  userId: string;
  hasProfile: boolean;
  verificationStatus?: string;
  isBadgeVerified?: boolean;
  status: string;
};

export function RowActions({ userId, hasProfile, verificationStatus, isBadgeVerified, status }: Props) {
  const [isPending, startTransition] = useTransition();
  const disabled = isPending || status === "deleted";

  return (
    <div className="flex flex-wrap gap-2 text-xs">
      {hasProfile && verificationStatus !== "approved" && (
        <button
          disabled={disabled}
          onClick={() => startTransition(() => approveUser(userId))}
          className="rounded px-2 py-1 disabled:opacity-50"
          style={{ border: "1px solid var(--border)" }}
        >
          Approve
        </button>
      )}
      {hasProfile && verificationStatus !== "rejected" && (
        <button
          disabled={disabled}
          onClick={() => startTransition(() => rejectUser(userId))}
          className="rounded px-2 py-1 disabled:opacity-50"
          style={{ border: "1px solid var(--border)" }}
        >
          Reject
        </button>
      )}
      {hasProfile && (
        <button
          disabled={disabled}
          onClick={() => startTransition(() => setBadge(userId, !isBadgeVerified))}
          className="rounded px-2 py-1 disabled:opacity-50"
          style={{ border: "1px solid var(--border)" }}
        >
          {isBadgeVerified ? "Revoke badge" : "Grant badge"}
        </button>
      )}
      <button
        disabled={disabled}
        onClick={() => startTransition(() => setBlocked(userId, status !== "blocked"))}
        className="rounded px-2 py-1 disabled:opacity-50"
        style={{ border: "1px solid var(--border)" }}
      >
        {status === "blocked" ? "Unblock" : "Block"}
      </button>
      <button
        disabled={disabled}
        onClick={() => {
          if (window.confirm("Soft-delete this user? This deactivates their login and anonymizes their profile.")) {
            startTransition(() => softDeleteUser(userId));
          }
        }}
        className="rounded px-2 py-1 disabled:opacity-50"
        style={{ border: "1px solid var(--danger)", color: "var(--danger)" }}
      >
        Delete
      </button>
    </div>
  );
}
