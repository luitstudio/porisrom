"use server";

import { revalidatePath } from "next/cache";

import { backendFetch } from "@/lib/backend-api";
import { requireSession } from "@/lib/session";

async function callAdmin(path: string, method: "PATCH" | "DELETE", body?: unknown) {
  const { accessToken } = await requireSession();
  await backendFetch(path, { method, body, accessToken });
  revalidatePath("/users");
}

export async function approveUser(userId: string) {
  try {
    await callAdmin(`/admin/users/${userId}/approve`, "PATCH");
    revalidatePath(`/users/${userId}`);
    return { ok: true as const };
  } catch {
    return { ok: false as const, error: "Could not approve this profile. Please try again." };
  }
}

export async function rejectUser(userId: string) {
  try {
    await callAdmin(`/admin/users/${userId}/reject`, "PATCH");
    revalidatePath(`/users/${userId}`);
    return { ok: true as const };
  } catch {
    return { ok: false as const, error: "Could not reject this profile. Please try again." };
  }
}

export async function reviewIdentityDocument(userId: string, status: "approved" | "rejected") {
  try {
    await callAdmin(`/admin/users/${userId}/identity-document/review`, "PATCH", { status });
    revalidatePath(`/users/${userId}`);
    return { ok: true as const };
  } catch {
    return { ok: false as const, error: "Could not update the identity document review. Please try again." };
  }
}

export async function setBadge(userId: string, isBadgeVerified: boolean) {
  await callAdmin(`/admin/users/${userId}/badge`, "PATCH", { isBadgeVerified });
}

export async function setBlocked(userId: string, blocked: boolean) {
  await callAdmin(`/admin/users/${userId}/block`, "PATCH", { blocked });
}

export async function softDeleteUser(userId: string) {
  await callAdmin(`/admin/users/${userId}`, "DELETE");
}
