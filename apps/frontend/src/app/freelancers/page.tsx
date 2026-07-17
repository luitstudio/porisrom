import Link from "next/link";
import type { Metadata } from "next";

import { auth } from "@/auth";
import { Footer } from "@/components/layout/footer";
import { Navbar } from "@/components/layout/navbar";
import { backendFetch } from "@/lib/backend-api";
import { STATES } from "@/lib/onboarding-data";

export const metadata: Metadata = {
  title: "Find Freelancers — Porisrom",
};

const EXPERIENCE_RANGES = ["Less than 1 year", "1–2 years", "3–5 years", "5+ years"];

type Category = { id: string; name: string; slug: string };

type FreelancerSearchItem = {
  id: string;
  bio: string | null;
  state: string | null;
  district: string | null;
  experienceLevel: string | null;
  isBadgeVerified: boolean;
  ratingAvg: number;
  ratingCount: number;
  user: { name: string };
  categories: { category: Category }[];
};

type SearchResult = {
  items: FreelancerSearchItem[];
  page: number;
  pageSize: number;
  total: number;
};

function buildQueryString(params: Record<string, string | undefined>) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) query.set(key, value);
  }
  return query.toString();
}

export default async function FreelancersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const categoryId = typeof params.categoryId === "string" ? params.categoryId : undefined;
  const state = typeof params.state === "string" ? params.state : undefined;
  const experienceLevel =
    typeof params.experienceLevel === "string" ? params.experienceLevel : undefined;
  const verifiedOnly = params.verifiedOnly === "true";
  const page = typeof params.page === "string" ? Number(params.page) || 1 : 1;

  const [session, categories, result] = await Promise.all([
    auth(),
    backendFetch<Category[]>("/categories"),
    backendFetch<SearchResult>(
      `/search/freelancers?${buildQueryString({
        categoryId,
        state,
        experienceLevel,
        verifiedOnly: verifiedOnly ? "true" : undefined,
        page: String(page),
        pageSize: "12",
      })}`
    ),
  ]);

  const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize));
  const isAuthenticated = Boolean(session);

  return (
    <div className="flex flex-1 flex-col">
      <Navbar isAuthenticated={isAuthenticated} />

      <main className="mx-auto w-full max-w-6xl flex-1 px-5 pt-28 pb-16 sm:px-8 sm:pt-32">
        <h1 className="font-display text-3xl font-semibold text-foreground">Find Freelancers</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {result.total} freelancer{result.total === 1 ? "" : "s"} found
        </p>

        <form className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-5" method="get">
          <select
            name="categoryId"
            defaultValue={categoryId ?? ""}
            className="h-10 rounded-lg border border-input bg-transparent px-3 text-sm text-foreground"
          >
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <select
            name="state"
            defaultValue={state ?? ""}
            className="h-10 rounded-lg border border-input bg-transparent px-3 text-sm text-foreground"
          >
            <option value="">All states</option>
            {STATES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <select
            name="experienceLevel"
            defaultValue={experienceLevel ?? ""}
            className="h-10 rounded-lg border border-input bg-transparent px-3 text-sm text-foreground"
          >
            <option value="">Any experience</option>
            {EXPERIENCE_RANGES.map((e) => (
              <option key={e} value={e}>
                {e}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-2 text-sm text-foreground">
            <input type="checkbox" name="verifiedOnly" value="true" defaultChecked={verifiedOnly} />
            Verified only
          </label>
          <button
            type="submit"
            className="h-10 rounded-lg bg-primary text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Apply filters
          </button>
        </form>

        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {result.items.map((item) => (
            <Link
              key={item.id}
              href={`/freelancers/${item.id}`}
              className="rounded-2xl border border-border bg-card p-5 transition-colors hover:border-primary/40"
            >
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-semibold text-foreground">{item.user.name}</h2>
                {item.isBadgeVerified && (
                  <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                    Verified
                  </span>
                )}
              </div>
              {(item.district || item.state) && (
                <p className="mt-1 text-xs text-muted-foreground">
                  {[item.district, item.state].filter(Boolean).join(", ")}
                </p>
              )}
              {item.bio && (
                <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{item.bio}</p>
              )}
              {item.categories.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {item.categories.map((c) => (
                    <span
                      key={c.category.id}
                      className="rounded-full bg-accent px-2.5 py-1 text-xs text-accent-foreground"
                    >
                      {c.category.name}
                    </span>
                  ))}
                </div>
              )}
            </Link>
          ))}
          {result.items.length === 0 && (
            <p className="col-span-full text-sm text-muted-foreground">
              No freelancers match these filters yet.
            </p>
          )}
        </div>

        {totalPages > 1 && (
          <div className="mt-10 flex items-center justify-center gap-2 text-sm">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <Link
                key={p}
                href={`/freelancers?${buildQueryString({
                  categoryId,
                  state,
                  experienceLevel,
                  verifiedOnly: verifiedOnly ? "true" : undefined,
                  page: String(p),
                })}`}
                className={
                  p === page
                    ? "font-semibold text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }
              >
                {p}
              </Link>
            ))}
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
