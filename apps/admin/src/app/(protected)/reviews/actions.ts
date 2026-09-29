"use server";

import { revalidatePath } from "next/cache";

import { backendFetch } from "@/lib/backend-api";
import { requireSession } from "@/lib/session";

export async function removeReview(reviewId: string) {
  try {
    const { accessToken } = await requireSession();
    await backendFetch(`/admin/reviews/${reviewId}`, { method: "DELETE", accessToken });
    revalidatePath("/reviews");
    return { ok: true as const };
  } catch {
    return { ok: false as const, error: "Could not remove this review. Please try again." };
  }
}
