"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { safetyAction } from "@/app/safety/actions";

export function SafetyForm({ operation, id, targetUserId, children, label }: {
  operation: string; id?: string; targetUserId?: string; children?: React.ReactNode; label: string;
}) {
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<{ message: string; error?: boolean }>();
  const router = useRouter();
  return <form className="my-3 space-y-2 rounded border p-3" action={async (form) => {
    setPending(true);
    try { const next = await safetyAction(form); setResult(next); if (!next.error) router.refresh(); }
    catch { setResult({ message: "The request could not be confirmed. Retry safely.", error: true }); }
    finally { setPending(false); }
  }}>
    <input type="hidden" name="operation" value={operation} />
    {id && <input type="hidden" name="id" value={id} />}
    {targetUserId && <input type="hidden" name="targetUserId" value={targetUserId} />}
    {children}
    <button className="rounded border px-3 py-2 text-sm" disabled={pending}>{pending ? "Recording…" : label}</button>
    {result && <p role={result.error ? "alert" : "status"} className="text-sm">{result.message}</p>}
  </form>;
}

export function ReasonField() {
  return <label className="block text-sm">Reason (10–2000 characters)<textarea name="reason" required minLength={10} maxLength={2000} className="mt-1 block w-full rounded border p-2" /></label>;
}

export function CounterpartSafety({ targetUserId }: { targetUserId: string }) {
  return <details className="my-4 text-sm"><summary>Block or report this user</summary>
    <p>Blocking hides this counterpart from your discovery and freezes shared work and messages. History stays available. Manage your blocks and support cases in <a className="underline" href="/safety">Safety & support</a>.</p>
    <SafetyForm operation="block" targetUserId={targetUserId} label="Block user" />
    <SafetyForm operation="report" targetUserId={targetUserId} label="Submit private report">
      <label>Category<select name="category" className="mx-2 rounded border p-2">{["harassment", "spam", "fraud", "inappropriate_content", "other"].map((v) => <option key={v} value={v}>{v.replaceAll("_", " ")}</option>)}</select></label>
      <ReasonField /><p>Report details are private to authorized administrators. Do not include passwords or identity documents.</p>
    </SafetyForm>
  </details>;
}

export function CancellationSafety({ id, pendingOther }: { id: string; pendingOther: boolean }) {
  return <details className="my-3 text-sm"><summary>Cancellation review and escalation</summary>
    <p>A pending or declined cancellation, or frozen shared work, can be sent to an administrator. This does not cancel work or move money.</p>
    <SafetyForm operation="escalate" id={id} label="Escalate cancellation"><ReasonField /></SafetyForm>
    {pendingOther && <SafetyForm operation="reject-cancellation" id={id} label="Decline cancellation request"><ReasonField /></SafetyForm>}
  </details>;
}
