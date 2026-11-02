"use server";

import { auth } from "@/auth";
import { backendFetch, getBackendUrl } from "@/lib/backend-api";

export type UpdateFreelancerProfileInput = {
  bio: string;
  address: string;
  state: string;
  district: string;
  languages: string[];
  experienceLevel: string;
  categoryIds: string[];
  skillIds: string[];
};

export async function updateFreelancerProfileAction(
  input: UpdateFreelancerProfileInput,
): Promise<{ success: true } | { success: false; error: string }> {
  const session = await auth();
  if (!session?.accessToken || session.user.role !== "freelancer") {
    return { success: false, error: "You need to be logged in as a freelancer." };
  }
  try {
    await backendFetch("/freelancers/me", {
      method: "PATCH",
      accessToken: session.accessToken,
      body: input,
    });
    return { success: true };
  } catch {
    return { success: false, error: "We couldn't save your profile. Please try again." };
  }
}

export async function uploadFreelancerProfilePhotoAction(
  formData: FormData,
): Promise<{ success: true; profilePhotoUrl: string } | { success: false; error: string }> {
  const session = await auth();
  if (!session?.accessToken || session.user.role !== "freelancer") {
    return { success: false, error: "You need to be logged in as a freelancer." };
  }

  try {
    const response = await fetch(`${getBackendUrl()}/freelancers/me/profile-photo`, {
      method: "POST",
      headers: { Authorization: `Bearer ${session.accessToken}` },
      body: formData,
      cache: "no-store",
    });
    const body = (await response.json().catch(() => null)) as { profilePhotoUrl?: string; message?: string | string[] } | null;
    if (!response.ok || !body?.profilePhotoUrl) {
      const message = Array.isArray(body?.message) ? body.message[0] : body?.message;
      return { success: false, error: message ?? "We couldn't upload your profile photo. Please try again." };
    }
    return { success: true, profilePhotoUrl: body.profilePhotoUrl };
  } catch {
    return { success: false, error: "We couldn't upload your profile photo. Please try again." };
  }
}
