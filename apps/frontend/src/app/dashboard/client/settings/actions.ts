"use server";

import { auth } from "@/auth";
import { backendFetch } from "@/lib/backend-api";

export type UpdateCompanyProfileInput = {
  companyName: string;
  logoUrl: string;
  about: string;
  address: string;
  state: string;
  categoryIds: string[];
};

export async function updateCompanyProfileAction(
  input: UpdateCompanyProfileInput,
): Promise<{ success: true } | { success: false; error: string }> {
  const session = await auth();
  if (!session?.accessToken || session.user.role !== "client") {
    return { success: false, error: "You need to be logged in as a client." };
  }
  if (!input.companyName.trim()) {
    return { success: false, error: "Company name is required." };
  }

  try {
    await backendFetch("/companies/me", {
      method: "PATCH",
      accessToken: session.accessToken,
      body: input,
    });
    return { success: true };
  } catch {
    return { success: false, error: "We couldn't save your company profile. Please try again." };
  }
}
