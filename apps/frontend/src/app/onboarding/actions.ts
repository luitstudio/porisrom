"use server";

import { auth } from "@/auth";
import { backendFetch, getBackendUrl } from "@/lib/backend-api";
import type { OnboardingRole } from "@/lib/onboarding-types";

function dashboardPathFor(role: OnboardingRole) {
  return role === "freelancer" ? "/dashboard/freelancer" : "/dashboard/client";
}

export type SubmitFreelancerProfileInput = {
  about: string;
  address: string;
  state: string;
  district: string;
  language: string;
  experience: string;
  categoryIds: string[];
  skillIds: string[];
  links: string[];
};

export type SubmitCompanyProfileInput = {
  companyName: string;
  about: string;
  address: string;
  state: string;
  categoryIds: string[];
};

export async function completeOnboardingAction(
  role: OnboardingRole,
  data: SubmitFreelancerProfileInput | SubmitCompanyProfileInput
): Promise<{ redirectTo: string } | { error: string }> {
  const session = await auth();
  if (!session?.accessToken) {
    return { error: "You need to be logged in to continue." };
  }

  try {
    if (role === "freelancer") {
      const freelancerData = data as SubmitFreelancerProfileInput;
      await backendFetch("/freelancers/me", {
        method: "PATCH",
        accessToken: session.accessToken,
        body: {
          bio: freelancerData.about,
          address: freelancerData.address,
          state: freelancerData.state,
          district: freelancerData.district,
          languages: freelancerData.language ? [freelancerData.language] : [],
          experienceLevel: freelancerData.experience,
          categoryIds: freelancerData.categoryIds,
          skillIds: freelancerData.skillIds,
        },
      });

      // Portfolio is deliberately link-based in V1; each public URL is saved directly.
      for (const link of freelancerData.links.filter((link) => link.trim().length > 0)) {
        await backendFetch("/freelancers/me/portfolio", {
          method: "POST",
          accessToken: session.accessToken,
          body: { title: "Portfolio link", type: "link", url: link },
        });
      }
    } else {
      const companyData = data as SubmitCompanyProfileInput;
      await backendFetch("/companies/me", {
        method: "PATCH",
        accessToken: session.accessToken,
        body: {
          companyName: companyData.companyName,
          about: companyData.about,
          address: companyData.address,
          state: companyData.state,
          categoryIds: companyData.categoryIds,
        },
      });
    }
  } catch {
    return { error: "Something went wrong while saving your profile. Please try again." };
  }

  return { redirectTo: dashboardPathFor(role) };
}

export async function uploadIdentityDocumentAction(
  formData: FormData,
): Promise<{ status: "pending" } | { error: string }> {
  const session = await auth();
  if (!session?.accessToken) return { error: "You need to be logged in to continue." };

  try {
    const response = await fetch(`${getBackendUrl()}/freelancers/me/identity-document`, {
      method: "POST",
      headers: { Authorization: `Bearer ${session.accessToken}` },
      body: formData,
      cache: "no-store",
    });
    const body = (await response.json().catch(() => null)) as { status?: "pending"; message?: string | string[] } | null;
    if (!response.ok || body?.status !== "pending") {
      const message = Array.isArray(body?.message) ? body.message[0] : body?.message;
      return { error: message ?? "We couldn’t submit your identity document. Please try again." };
    }
    return { status: "pending" };
  } catch {
    return { error: "We couldn’t submit your identity document. Please try again." };
  }
}
