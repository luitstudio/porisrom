"use client";
import { useActionState } from "react";
import { reviewSafetyCase } from "./actions";
export function CaseReviewForm({ id, kind }: { id: string; kind: string }) {
  const [message, action, pending] = useActionState(reviewSafetyCase, "");
  const decisions = kind === "cancellation" ? ["cancel_assignment", "deny_cancellation", "dismiss"] : ["resolve", "dismiss"];
  return <form action={action} className="admin-form"><input type="hidden" name="id" value={id} />
    <label>Decision<select name="decision">{decisions.map((v) => <option key={v} value={v}>{v.replaceAll("_", " ")}</option>)}</select></label>
    <label>Reason<textarea name="reason" required minLength={10} maxLength={2000} /></label>
    <p>Cancellation decisions are shared with both participants. Report details remain private. No refund or transfer is performed.</p>
    <button disabled={pending}>{pending ? "Saving…" : "Save audited decision"}</button>
    {message && <p role="status">{message}</p>}
  </form>;
}
