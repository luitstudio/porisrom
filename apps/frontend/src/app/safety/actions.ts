"use server";

import { auth } from "@/auth";
import { BackendApiError, backendFetch } from "@/lib/backend-api";
import { revalidatePath } from "next/cache";

export async function safetyAction(form: FormData): Promise<{ message: string; error?: boolean }> {
  const session = await auth();
  if (!session?.accessToken || session.error) return { message: "Sign in again to continue.", error: true };
  const operation = String(form.get("operation") ?? "");
  const target = String(form.get("targetUserId") ?? "");
  const id = String(form.get("id") ?? "");
  const reason = String(form.get("reason") ?? "").trim();
  let path: string; let method: "POST" | "DELETE" | "PATCH" = "POST"; let body: unknown;
  switch (operation) {
    case "block": path = "/safety/blocks"; body = { blockedUserId: target }; break;
    case "unblock": path = `/safety/blocks/${encodeURIComponent(id)}`; method = "DELETE"; break;
    case "report": path = "/safety/reports"; body = { targetUserId: target, category: String(form.get("category")), reason }; break;
    case "support": path = "/safety/support"; body = { category: String(form.get("category")), reason }; break;
    case "escalate": path = `/safety/assignments/${encodeURIComponent(id)}/escalate-cancellation`; body = { reason }; break;
    case "reject-cancellation": path = `/work-assignments/${encodeURIComponent(id)}/cancellation/reject`; method = "PATCH"; body = { reason }; break;
    default: return { message: "Unknown safety action.", error: true };
  }
  try { await backendFetch(path, { method, body, accessToken: session.accessToken }); }
  catch (error) {
    if (error instanceof BackendApiError) return { message: error.message, error: true };
    throw error;
  }
  revalidatePath("/safety");
  return { message: operation === "block" ? "Blocked. Shared conversations and work are read-only. No assignment was cancelled." :
    operation === "unblock" ? "Your block was removed. Other blocks and account restrictions still apply." : "Request recorded. No funds were moved." };
}
