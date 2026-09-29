"use server";

import { auth } from "@/auth";
import { backendFetch } from "@/lib/backend-api";

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
