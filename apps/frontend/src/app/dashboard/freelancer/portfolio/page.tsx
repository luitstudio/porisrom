import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { PortfolioManager } from "@/components/dashboard/freelancer/portfolio-manager";
import type { PortfolioItem } from "./actions";
import { backendFetch } from "@/lib/backend-api";

export const metadata: Metadata = { title: "Portfolio — Porisrom" };

type FreelancerPortfolioResponse = { portfolioItems: PortfolioItem[] };

export default async function PortfolioPage() {
  const session = await auth();
  if (!session?.accessToken) redirect("/auth/login");
  if (session.user.role !== "freelancer") redirect("/dashboard/client");

  let items: PortfolioItem[] | null = null;
  try {
    const profile = await backendFetch<FreelancerPortfolioResponse>("/freelancers/me", {
      accessToken: session.accessToken,
    });
    items = profile.portfolioItems;
  } catch {
    items = null;
  }

  if (!items) {
    return (
      <main className="p-4 sm:p-6 lg:p-8">
        <div className="mx-auto max-w-5xl rounded-xl border border-destructive/30 bg-destructive/5 p-6">
          <h1 className="font-display text-2xl font-semibold">Portfolio</h1>
          <p className="mt-2 text-sm text-destructive">
            We couldn&apos;t load your portfolio. Please refresh the page and try again.
          </p>
        </div>
      </main>
    );
  }

  return <PortfolioManager initialItems={items} />;
}
