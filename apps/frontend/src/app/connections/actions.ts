"use server";

import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import { BackendApiError, backendFetch } from "@/lib/backend-api";

export type ConnectionActionResult = { error?: string; success?: boolean };

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

export async function acceptConnectionAction(
  connectionId: string,
  revalidatePathValue: string
): Promise<ConnectionActionResult> {
  try {
    const accessToken = await requireAccessToken();
    await backendFetch(`/connections/${connectionId}/accept`, {
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
