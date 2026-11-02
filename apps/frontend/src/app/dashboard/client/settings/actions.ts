"use server";

import { auth } from "@/auth";
import { backendFetch, getBackendUrl } from "@/lib/backend-api";

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

export async function uploadCompanyLogoAction(
  formData: FormData,
): Promise<{ success: true; logoUrl: string } | { success: false; error: string }> {
  const session = await auth();
  if (!session?.accessToken || session.user.role !== "client") {
    return { success: false, error: "You need to be logged in as a client." };
  }

  try {
    const response = await fetch(`${getBackendUrl()}/companies/me/logo`, {
      method: "POST",
      headers: { Authorization: `Bearer ${session.accessToken}` },
      body: formData,
      cache: "no-store",
    });
    const body = (await response.json().catch(() => null)) as { logoUrl?: string; message?: string | string[] } | null;
    if (!response.ok || !body?.logoUrl) {
      const message = Array.isArray(body?.message) ? body.message[0] : body?.message;
      return { success: false, error: message ?? "We couldn't upload your business photo. Please try again." };
    }
    return { success: true, logoUrl: body.logoUrl };
  } catch {
    return { success: false, error: "We couldn't upload your business photo. Please try again." };
  }
}
