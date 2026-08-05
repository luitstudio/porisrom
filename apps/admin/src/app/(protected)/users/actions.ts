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
  await callAdmin(`/admin/users/${userId}/approve`, "PATCH");
}

export async function rejectUser(userId: string) {
  await callAdmin(`/admin/users/${userId}/reject`, "PATCH");
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
