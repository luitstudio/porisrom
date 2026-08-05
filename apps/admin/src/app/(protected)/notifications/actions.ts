"use server";

import { revalidatePath } from "next/cache";

import { backendFetch } from "@/lib/backend-api";
import { requireSession } from "@/lib/session";

export type NotificationFormState = { error?: string; success?: string };

export async function broadcast(
  _prevState: NotificationFormState,
  formData: FormData,
): Promise<NotificationFormState> {
  const message = String(formData.get("message") ?? "").trim();
  const type = String(formData.get("type") ?? "").trim() || "announcement";
  if (!message) return { error: "Message is required" };

  const { accessToken } = await requireSession();
  await backendFetch("/admin/notifications/broadcast", {
    method: "POST",
    body: { type, message },
    accessToken,
  });
  revalidatePath("/notifications");
  return { success: "Broadcast sent to all users" };
}

export async function sendDirectMessage(
  _prevState: NotificationFormState,
  formData: FormData,
): Promise<NotificationFormState> {
  const userId = String(formData.get("userId") ?? "").trim();
  const message = String(formData.get("directMessage") ?? "").trim();
  if (!userId) return { error: "Select a recipient" };
  if (!message) return { error: "Message is required" };

  const { accessToken } = await requireSession();
  await backendFetch("/admin/messages/direct", {
    method: "POST",
    body: { userId, message },
    accessToken,
  });
  revalidatePath("/notifications");
  return { success: "Message sent" };
}
