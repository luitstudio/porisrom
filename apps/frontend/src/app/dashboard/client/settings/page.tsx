import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { CompanyProfileForm } from "@/components/dashboard/company-profile-form";
import { backendFetch } from "@/lib/backend-api";
import type { TaxonomyItem } from "@/lib/onboarding-types";

export const metadata: Metadata = { title: "Company profile settings — Porisrom" };

export type CompanyOwnerProfile = {
  id: string;
  companyName: string;
  logoUrl: string | null;
  about: string | null;
  address: string | null;
  state: string | null;
  verificationStatus: string;
  categories: { category: TaxonomyItem }[];
};

export default async function CompanySettingsPage() {
  const session = await auth();
  if (!session?.accessToken) redirect("/auth/login");
  if (session.user.role !== "client") redirect("/dashboard/freelancer");

  let data: { profile: CompanyOwnerProfile; categories: TaxonomyItem[] } | null = null;
  try {
    const [profile, categories] = await Promise.all([
      backendFetch<CompanyOwnerProfile>("/companies/me", { accessToken: session.accessToken }),
      backendFetch<TaxonomyItem[]>("/categories"),
    ]);
    data = { profile, categories };
  } catch {
    data = null;
  }

  if (!data) {
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6">
        <h1 className="font-display text-2xl font-semibold">Company profile settings</h1>
        <p className="mt-2 text-sm text-destructive">
          We couldn&apos;t load your company profile. Please refresh the page and try again.
        </p>
      </div>
    );
  }

  return <CompanyProfileForm profile={data.profile} categories={data.categories} />;
}
