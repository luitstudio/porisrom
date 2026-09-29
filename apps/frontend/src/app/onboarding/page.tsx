import type { Metadata } from "next";

import { auth } from "@/auth";
import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard";
import { backendFetch } from "@/lib/backend-api";
import type { TaxonomyItem } from "@/lib/onboarding-types";

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

  return (
    <OnboardingWizard
      freelancerCategories={categories}
      freelancerSkills={freelancerSkills}
      companyCategories={categories}
    />
  );
}
