"use server";

import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import { BackendApiError, backendFetch } from "@/lib/backend-api";

export type ConnectionRecord = {
  id: string;
  requesterId: string;
  receiverId: string;
  status: "pending" | "accepted" | "declined";
  requester: { id: string; name: string; role: "client" | "freelancer" };
  receiver: { id: string; name: string; role: "client" | "freelancer" };
  conversation: { id: string } | null;
};

export type ConnectionActionResult = {
  error?: string;
  success?: boolean;
  connection?: ConnectionRecord;
};

async function requireAccessToken() {
  const session = await auth();
  if (!session?.accessToken) {
    throw new Error("Not authenticated");
  }
  return session.accessToken;
}

export async function sendConnectionRequestAction(
  receiverId: string,
  revalidatePathValue: string
): Promise<ConnectionActionResult> {
  try {
    const accessToken = await requireAccessToken();
    await backendFetch("/connections", {
      method: "POST",
      accessToken,
      body: { receiverId },
    });
  } catch (err) {
    if (err instanceof BackendApiError) return { error: err.message };
    return { error: "Something went wrong. Please try again." };
  }
  revalidatePath(revalidatePathValue);
  return { success: true };
}

export async function listConnectionsAction(): Promise<ConnectionRecord[]> {
  const accessToken = await requireAccessToken();
  return backendFetch<ConnectionRecord[]>("/connections", { accessToken });
}

export async function acceptConnectionAction(
  connectionId: string,
  revalidatePathValue: string
): Promise<ConnectionActionResult> {
  try {
    const accessToken = await requireAccessToken();
    const connection = await backendFetch<ConnectionRecord>(`/connections/${connectionId}/accept`, {
      method: "PATCH",
      accessToken,
    });
    revalidatePath(revalidatePathValue);
    return { success: true, connection };
  } catch (err) {
    if (err instanceof BackendApiError) return { error: err.message };
    return { error: "Something went wrong. Please try again." };
  }
}

export async function declineConnectionAction(
  connectionId: string,
  revalidatePathValue: string
): Promise<ConnectionActionResult> {
  try {
    const accessToken = await requireAccessToken();
    await backendFetch(`/connections/${connectionId}/decline`, {
      method: "PATCH",
      accessToken,
    });
  } catch (err) {
    if (err instanceof BackendApiError) return { error: err.message };
    return { error: "Something went wrong. Please try again." };
  }
  revalidatePath(revalidatePathValue);
  return { success: true };
}
