import Link from "next/link";
import type { Metadata } from "next";

import { auth } from "@/auth";
import { Footer } from "@/components/layout/footer";
import { Navbar } from "@/components/layout/navbar";
import { backendFetch } from "@/lib/backend-api";

export const metadata: Metadata = {
  title: "Company Leaderboard — Porisrom",
};

type LeaderboardEntry = {
  id: string;
  companyName: string;
  ratingAvg: number;
  ratingCount: number;
  isBadgeVerified: boolean;
  categories: { category: { id: string; name: string } }[];
};

export default async function CompanyLeaderboardPage() {
  const [session, entries] = await Promise.all([
    auth(),
    backendFetch<LeaderboardEntry[]>("/leaderboard/companies"),
  ]);
  const isAuthenticated = Boolean(session);

  return (
    <div className="flex flex-1 flex-col">
      <Navbar isAuthenticated={isAuthenticated} />

      <main className="mx-auto w-full max-w-4xl flex-1 px-5 pt-28 pb-16 sm:px-8 sm:pt-32">
        <h1 className="font-display text-3xl font-semibold text-foreground">
          Company Leaderboard
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Top-rated companies, ranked by average rating (minimum review count required to
          appear).
        </p>

        <ol className="mt-8 flex flex-col gap-3">
          {entries.map((entry, index) => (
            <li key={entry.id}>
              <Link
                href={`/companies/${entry.id}`}
                className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-card p-4 transition-colors hover:border-primary/40"
              >
                <div className="flex items-center gap-4">
                  <span className="w-6 text-right text-sm font-semibold text-muted-foreground">
                    {index + 1}
                  </span>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-foreground">{entry.companyName}</span>
                      {entry.isBadgeVerified && (
                        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                          Verified
                        </span>
                      )}
                    </div>
                    {entry.categories.length > 0 && (
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {entry.categories.map((c) => c.category.name).join(", ")}
                      </p>
                    )}
                  </div>
                </div>
                <span className="shrink-0 text-sm font-semibold text-foreground">
                  {entry.ratingAvg.toFixed(1)}{" "}
                  <span className="font-normal text-muted-foreground">
                    ({entry.ratingCount})
                  </span>
                </span>
              </Link>
            </li>
          ))}
          {entries.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No companies have enough reviews to rank yet.
            </p>
          )}
        </ol>
      </main>

      <Footer />
    </div>
  );
}
