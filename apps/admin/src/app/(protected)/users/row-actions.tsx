"use client";

import { useTransition } from "react";

import { setBadge, setBlocked, softDeleteUser } from "./actions";

type Props = {
  userId: string;
  role: string | null;
  hasProfile: boolean;
  verificationStatus?: string;
  isBadgeVerified?: boolean;
  status: string;
};

export function RowActions({ userId, role, hasProfile, isBadgeVerified, status }: Props) {
  const [isPending, startTransition] = useTransition();
  const disabled = isPending || status === "deleted";

  return (
    <div className="flex flex-wrap gap-2 text-xs">
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
      {role !== "admin" && (
        <>
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
        </>
      )}
    </div>
  );
}
