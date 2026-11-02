"use server";
import { revalidatePath } from "next/cache";
import { backendFetch, BackendApiError } from "@/lib/backend-api";
import { requireSession } from "@/lib/session";

export async function reviewSafetyCase(_state: string, form: FormData): Promise<string> {
  const session = await requireSession();
  const id = String(form.get("id"));
  try { await backendFetch(`/admin/safety/cases/${encodeURIComponent(id)}/review`, {
    method: "POST", accessToken: session.accessToken,
    body: { decision: String(form.get("decision")), reason: String(form.get("reason")) },
  }); } catch (error) { if (error instanceof BackendApiError) return error.message; throw error; }
  revalidatePath("/safety");
  return "Review saved with its audit record. No bank settlement was performed.";
}
