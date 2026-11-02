"use client";
import { useActionState } from "react";
import { resolveDispute } from "./actions";

export function ResolutionForm({ paymentId, mismatchCount }: { paymentId: string; mismatchCount: number }) {
  const [state, action, pending] = useActionState(resolveDispute, {});
  return <form action={action} className="card flex max-w-2xl flex-col gap-3 p-5">
    <h2 className="font-semibold">Record a dispute decision</h2>
    <p className="text-sm">This records a manual review decision. It does not move money or verify bank settlement. Claim and assignment history will be retained.</p>
    <input type="hidden" name="paymentId" value={paymentId} />
    <input type="hidden" name="expectedMismatchCount" value={mismatchCount} />
    <label className="text-sm">Decision
      <select name="outcome" required disabled={pending} defaultValue="" className="mt-1 w-full rounded border p-2" style={{ background: "var(--background)" }}>
        <option value="" disabled>Select a decision</option>
        <option value="reopen_claims">Reopen participant reference claims</option>
        <option value="complete">Mark administratively resolved and complete assignment</option>
      </select>
    </label>
    <label className="text-sm">Reason and evidence summary
      <textarea name="reason" required minLength={10} maxLength={2000} rows={4} disabled={pending} className="mt-1 w-full rounded border p-2" />
    </label>
    {state.error && <p role="alert" style={{ color: "var(--danger)" }}>{state.error}</p>}
    {state.success && <p role="status">{state.success}</p>}
    <button disabled={pending} className="self-start rounded px-4 py-2 text-white disabled:opacity-60" style={{ background: "var(--primary)" }}>{pending ? "Recording..." : "Record decision"}</button>
  </form>;
}
