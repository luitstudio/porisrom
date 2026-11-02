"use server";

import { revalidatePath } from "next/cache";
import { backendFetch, BackendApiError } from "@/lib/backend-api";
import { requireSession } from "@/lib/session";

export type ResolutionState = { error?: string; success?: string };
export async function resolveDispute(_previous: ResolutionState, form: FormData): Promise<ResolutionState> {
  const { accessToken } = await requireSession();
  const paymentId = String(form.get("paymentId") ?? "");
  const outcome = String(form.get("outcome") ?? "");
  const reason = String(form.get("reason") ?? "").trim();
  const expectedMismatchCount = Number(form.get("expectedMismatchCount"));
  if (!paymentId || !["reopen_claims", "complete"].includes(outcome) || reason.length < 10 || reason.length > 2000 || !Number.isInteger(expectedMismatchCount) || expectedMismatchCount < 3) {
    return { error: "Select a decision and provide a reason between 10 and 2,000 characters." };
  }
  try {
    await backendFetch(`/admin/payments/${encodeURIComponent(paymentId)}/resolve`, { method: "POST", accessToken,
      body: { outcome, reason, expectedMismatchCount } });
  } catch (error) {
    if (error instanceof BackendApiError) return { error: error.message };
    return { error: "The decision could not be confirmed. Reload the dispute to check its state before retrying." };
  }
  revalidatePath("/payments"); revalidatePath(`/payments/${paymentId}`); revalidatePath("/action-log");
  return { success: outcome === "complete" ? "Administrative completion recorded. Bank settlement was not verified." : "Participant claims reopened. Both participants have been notified." };
}
