import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { FreelancerProfileForm } from "@/components/dashboard/freelancer/freelancer-profile-form";
import { GoogleLinkSettingsCard } from "@/components/auth/google-link-settings-card";
import { backendFetch } from "@/lib/backend-api";
import type { TaxonomyItem } from "@/lib/onboarding-types";

export const metadata: Metadata = { title: "Profile settings — Porisrom" };

export type FreelancerOwnerProfile = {
  id: string;
  bio: string | null;
  profilePhotoUrl: string | null;
  address: string | null;
  state: string | null;
  district: string | null;
  languages: string[];
  experienceLevel: string | null;
  verificationStatus: string;
  identityDocumentReview: { status: "not_submitted" | "pending" | "approved" | "rejected"; reviewedAt: string | null };
  categories: { category: TaxonomyItem }[];
  skills: { skill: TaxonomyItem & { categoryId: string | null } }[];
  user: { id: string; name: string };
};

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ googleLink?: string }> }) {
  const { googleLink } = await searchParams;
  const session = await auth();
  if (!session?.accessToken) redirect("/auth/login");
  if (session.user.role !== "freelancer") redirect("/dashboard/client");

  let data:
    | {
        profile: FreelancerOwnerProfile;
        categories: TaxonomyItem[];
        skills: (TaxonomyItem & { categoryId?: string | null })[];
      }
    | null = null;
  try {
    const [profile, categories, skills] = await Promise.all([
      backendFetch<FreelancerOwnerProfile>("/freelancers/me", { accessToken: session.accessToken }),
      backendFetch<TaxonomyItem[]>("/categories"),
      backendFetch<(TaxonomyItem & { categoryId?: string | null })[]>("/skills"),
    ]);
    data = { profile, categories, skills };
  } catch {
    data = null;
  }

  if (!data) {
    return (
      <main className="p-4 sm:p-6 lg:p-8">
        <div className="mx-auto max-w-5xl rounded-xl border border-destructive/30 bg-destructive/5 p-6">
          <h1 className="font-display text-2xl font-semibold">Profile settings</h1>
          <p className="mt-2 text-sm text-destructive">
            We couldn&apos;t load your profile. Please refresh the page and try again.
          </p>
        </div>
      </main>
    );
  }

  return <><FreelancerProfileForm profile={data.profile} categories={data.categories} skills={data.skills} /><div className="mx-auto max-w-5xl px-4 pb-8 sm:px-6 lg:px-8"><GoogleLinkSettingsCard result={googleLink} /></div></>;
}
