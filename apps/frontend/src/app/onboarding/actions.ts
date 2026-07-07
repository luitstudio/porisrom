"use server";

import { auth } from "@/auth";
import { backendFetch } from "@/lib/backend-api";
import type { OnboardingRole } from "@/lib/onboarding-types";

function dashboardPathFor(role: OnboardingRole) {
  return role === "freelancer" ? "/dashboard/freelancer" : "/dashboard/client";
}

type Category = { id: string; name: string };
type Skill = { id: string; name: string };

async function resolveIdsByName(kind: "categories" | "skills", names: string[]): Promise<string[]> {
  if (names.length === 0) return [];
  const items = await backendFetch<Category[] | Skill[]>(`/${kind}`);
  const byName = new Map(items.map((item) => [item.name, item.id]));
  return names.map((name) => byName.get(name)).filter((id): id is string => Boolean(id));
}

export type SubmitFreelancerProfileInput = {
  about: string;
  address: string;
  state: string;
  district: string;
  language: string;
  experience: string;
  professions: string[];
  skills: string[];
  links: string[];
};

export type SubmitCompanyProfileInput = {
  companyName: string;
  about: string;
  address: string;
  state: string;
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
      const [categoryIds, skillIds] = await Promise.all([
        resolveIdsByName("categories", freelancerData.professions),
        resolveIdsByName("skills", freelancerData.skills),
      ]);

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
          categoryIds,
          skillIds,
        },
      });

      // Portfolio file uploads aren't wired yet (pending the storage-backend decision),
      // but plain links need no storage and can be saved immediately.
      for (const link of freelancerData.links.filter((link) => link.trim().length > 0)) {
        await backendFetch("/freelancers/me/portfolio", {
          method: "POST",
          accessToken: session.accessToken,
          body: { title: "Portfolio link", type: "link", url: link },
        });
      }
    } else {
      const companyData = data as SubmitCompanyProfileInput;
      // Note: the client onboarding UI's category picker offers business-type labels
      // (e.g. "Tech Startup") that don't match the seeded Category taxonomy (which is
      // freelancer professions, used for hiring-category search). Not sent until that's
      // reconciled — see docs/roadmap.md.
      await backendFetch("/companies/me", {
        method: "PATCH",
        accessToken: session.accessToken,
        body: {
          companyName: companyData.companyName,
          about: companyData.about,
          address: companyData.address,
          state: companyData.state,
        },
      });
    }
  } catch {
    return { error: "Something went wrong while saving your profile. Please try again." };
  }

  return { redirectTo: dashboardPathFor(role) };
}
