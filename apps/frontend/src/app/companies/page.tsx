import Link from "next/link";
import type { Metadata } from "next";

import { auth } from "@/auth";
import { DiscoveryUnavailable } from "@/components/common/discovery-unavailable";
import { CompanyDiscoveryTransition } from "@/components/discovery/company-discovery-transition";
import { Footer } from "@/components/layout/footer";
import { Navbar } from "@/components/layout/navbar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { backendFetch } from "@/lib/backend-api";
import { STATES } from "@/lib/onboarding-data";

export const metadata: Metadata = {
  title: "Find Companies — Porisrom",
};

const RATING_OPTIONS = ["5", "4", "3", "2", "1"];

type Category = { id: string; name: string; slug: string };

type CompanySearchItem = {
  id: string;
  companyName: string;
  logoUrl: string | null;
  about: string | null;
  state: string | null;
  isBadgeVerified: boolean;
  ratingAvg: number;
  ratingCount: number;
  user: { name: string };
  categories: { category: Category }[];
};

type SearchResult = {
  items: CompanySearchItem[];
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

function initialsFor(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase() || "C";
}

export default async function CompaniesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const keyword = typeof params.keyword === "string" ? params.keyword : undefined;
  const categoryId = typeof params.categoryId === "string" ? params.categoryId : undefined;
  const state = typeof params.state === "string" ? params.state : undefined;
  const minRating = typeof params.minRating === "string" ? params.minRating : undefined;
  const verifiedOnly = params.verifiedOnly === "true";
  const page = typeof params.page === "string" ? Number(params.page) || 1 : 1;

  const session = await auth();
  const [categories, result] = await Promise.all([
    backendFetch<Category[]>("/categories").catch(() => null),
    backendFetch<SearchResult>(
      `/search/companies?${buildQueryString({
        keyword,
        categoryId,
        state,
        minRating,
        verifiedOnly: verifiedOnly ? "true" : undefined,
        page: String(page),
        pageSize: "12",
      })}`, { accessToken: session?.accessToken }
    ).catch(() => null),
  ]);

  if (!categories || !result) {
    return <DiscoveryUnavailable title="Find Companies" isAuthenticated={Boolean(
      session?.user?.id && session.accessToken && !session.error
    )} />;
  }

  const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize));
  const hasActiveFilters = Boolean(keyword || categoryId || state || minRating || verifiedOnly || page > 1);
  const activeFilterLabels = [
    keyword ? `Search: ${keyword}` : null,
    categoryId ? categories.find(({ id }) => id === categoryId)?.name ?? "Category" : null,
    state ?? null,
    minRating ? `${minRating}+ rating` : null,
    verifiedOnly ? "Verified only" : null,
  ].filter((label): label is string => Boolean(label));
  const pageHref = (nextPage: number) =>
    `/companies?${buildQueryString({
      keyword,
      categoryId,
      state,
      minRating,
      verifiedOnly: verifiedOnly ? "true" : undefined,
      page: String(nextPage),
    })}`;
  const isAuthenticated = Boolean(
    session?.user?.id && session.accessToken && !session.error
  );

  return (
    <div className="flex flex-1 flex-col">
      <Navbar isAuthenticated={isAuthenticated} />

      <main className="mx-auto w-full max-w-6xl flex-1 px-5 pt-28 pb-16 sm:px-8 sm:pt-32">
        <CompanyDiscoveryTransition>
        <h1 className="font-display text-3xl font-semibold text-foreground">Find Companies</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {result.total} compan{result.total === 1 ? "y" : "ies"} found
        </p>

        <form data-company-discovery-form className="mt-6 grid grid-cols-1 gap-3 min-[430px]:grid-cols-2 md:grid-cols-3 lg:grid-cols-6" method="get">
          <input
            type="search"
            name="keyword"
            defaultValue={keyword ?? ""}
            placeholder="Search companies..."
            className="h-11 min-w-0 rounded-lg border border-input bg-transparent px-3 text-base text-foreground min-[430px]:col-span-2 sm:col-span-2 sm:text-sm"
          />
          <select
            name="categoryId"
            aria-label="Filter companies by category"
            defaultValue={categoryId ?? ""}
            className="h-11 min-w-0 w-full rounded-lg border border-input bg-transparent px-3 text-base text-foreground sm:text-sm"
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
            aria-label="Filter companies by state"
            defaultValue={state ?? ""}
            className="h-11 min-w-0 w-full rounded-lg border border-input bg-transparent px-3 text-base text-foreground sm:text-sm"
          >
            <option value="">All states</option>
            {STATES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <select
            name="minRating"
            aria-label="Filter companies by minimum rating"
            defaultValue={minRating ?? ""}
            className="h-11 min-w-0 w-full rounded-lg border border-input bg-transparent px-3 text-base text-foreground sm:text-sm"
          >
            <option value="">Any rating</option>
            {RATING_OPTIONS.map((rating) => (
              <option key={rating} value={rating}>
                {rating}+ rating
              </option>
            ))}
          </select>
          <label className="flex h-11 items-center gap-2 rounded-lg border border-input px-3 text-sm text-foreground">
            <input type="checkbox" name="verifiedOnly" value="true" defaultChecked={verifiedOnly} />
            Verified only
          </label>
          <button
            type="submit"
            className="h-11 rounded-lg bg-primary text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Apply filters
          </button>
        </form>

        {hasActiveFilters && (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {activeFilterLabels.map((label) => (
              <span key={label} className="max-w-full truncate rounded-full bg-accent px-3 py-1.5 text-xs text-accent-foreground">
                {label}
              </span>
            ))}
            <Link data-company-discovery-navigation href="/companies" className="ml-auto min-h-11 shrink-0 content-center px-2 text-sm font-medium text-primary hover:underline">
              Clear filters
            </Link>
          </div>
        )}

        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {result.items.map((item) => (
            <Link
              key={item.id}
              href={`/companies/${item.id}`}
              className="rounded-2xl border border-border bg-card p-5 transition-colors hover:border-primary/40"
            >
              <div className="flex items-start gap-3">
                <Avatar className="size-12">
                  {item.logoUrl && <AvatarImage src={item.logoUrl} alt="" />}
                  <AvatarFallback className="bg-accent text-sm font-semibold text-accent-foreground">
                    {initialsFor(item.companyName)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="min-w-0 break-words font-semibold text-foreground">{item.companyName}</h2>
                    {item.isBadgeVerified && (
                      <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                        Verified
                      </span>
                    )}
                  </div>
                  {item.state && <p className="mt-1 text-xs text-muted-foreground">{item.state}</p>}
                </div>
              </div>
              {item.about && (
                <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{item.about}</p>
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
            <div className="col-span-full rounded-2xl border border-border bg-card p-8 text-center">
              <p className="text-sm text-muted-foreground">
                {keyword ? "No companies match your search." : "No companies match these filters yet."}
              </p>
              {hasActiveFilters && (
                <Link
                  data-company-discovery-navigation
                  href="/companies"
                  className="mt-4 inline-flex h-10 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                >
                  Clear filters and view all
                </Link>
              )}
            </div>
          )}
        </div>

        {totalPages > 1 && (
          <nav className="mt-10 flex w-full items-center justify-between gap-2 text-sm sm:justify-center sm:gap-4" aria-label="Company results pages">
            {page <= 1 ? (
              <span aria-disabled="true" className="flex min-h-11 flex-1 items-center justify-center rounded-lg border border-border px-3 py-2 text-muted-foreground opacity-50 sm:flex-none sm:px-4">
                Previous
              </span>
            ) : (
              <Link
                data-company-discovery-navigation
                href={pageHref(page - 1)}
                className="flex min-h-11 flex-1 items-center justify-center rounded-lg border border-border px-3 py-2 font-medium text-foreground hover:border-primary/40 hover:text-primary sm:flex-none sm:px-4"
              >
                Previous
              </Link>
            )}
            <span className="shrink-0 whitespace-nowrap text-xs text-muted-foreground sm:text-sm">Page {page} of {totalPages}</span>
            {page >= totalPages ? (
              <span aria-disabled="true" className="flex min-h-11 flex-1 items-center justify-center rounded-lg border border-border px-3 py-2 text-muted-foreground opacity-50 sm:flex-none sm:px-4">
                Next
              </span>
            ) : (
              <Link
                data-company-discovery-navigation
                href={pageHref(page + 1)}
                className="flex min-h-11 flex-1 items-center justify-center rounded-lg border border-border px-3 py-2 font-medium text-foreground hover:border-primary/40 hover:text-primary sm:flex-none sm:px-4"
              >
                Next
              </Link>
            )}
          </nav>
        )}
        </CompanyDiscoveryTransition>
      </main>

      <Footer />
    </div>
  );
}
