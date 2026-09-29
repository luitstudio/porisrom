"use server";

import { auth } from "@/auth";
import { backendFetch } from "@/lib/backend-api";

export type NotificationItem = {
  id: string;
  type: string;
  message: string;
  isRead: boolean;
  createdAt: string;
};

async function requireAccessToken() {
  const session = await auth();
  if (!session?.accessToken) throw new Error("Not authenticated");
  return session.accessToken;
}

export async function listNotificationsAction(): Promise<NotificationItem[]> {
  return backendFetch<NotificationItem[]>("/notifications", { accessToken: await requireAccessToken() });
}

export async function markNotificationReadAction(id: string): Promise<NotificationItem> {
  return backendFetch<NotificationItem>(`/notifications/${encodeURIComponent(id)}/read`, {
    method: "PATCH",
    accessToken: await requireAccessToken(),
  });
}
