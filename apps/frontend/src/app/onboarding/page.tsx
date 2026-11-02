import type { Metadata } from "next";

import { auth } from "@/auth";
import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard";
import { backendFetch, BackendApiError } from "@/lib/backend-api";
import type { TaxonomyItem, OnboardingDraft } from "@/lib/onboarding-types";

export const metadata: Metadata = {
  title: "Set up your profile — Porisrom",
};

export default async function OnboardingPage() {
  const session = await auth();
  const [categories, freelancerSkills] =
    session?.user.role === "freelancer"
      ? await Promise.all([
          backendFetch<TaxonomyItem[]>("/categories"),
          backendFetch<TaxonomyItem[]>("/skills"),
        ])
      : session?.user.role === "client"
        ? [await backendFetch<TaxonomyItem[]>("/categories"), []]
        : [[], []];

  let draft: OnboardingDraft | undefined;
  if (session?.accessToken && ["client", "freelancer"].includes(session.user.role ?? "")) {
    try { draft = await backendFetch<OnboardingDraft>(session.user.role === "client" ? "/companies/me" : "/freelancers/me", { accessToken: session.accessToken }); }
    catch (error) { if (!(error instanceof BackendApiError && error.status === 404)) throw error; }
  }
  return (
    <OnboardingWizard
      draft={draft}
      freelancerCategories={categories}
      freelancerSkills={freelancerSkills}
      companyCategories={categories}
    />
  );
}
