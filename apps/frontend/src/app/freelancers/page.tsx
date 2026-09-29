import Link from "next/link";
import type { Metadata } from "next";

import { auth } from "@/auth";
import { FreelancerDiscoveryError } from "@/components/discovery/freelancer-discovery-error";
import { FreelancerDiscoveryTransition } from "@/components/discovery/freelancer-discovery-transition";
import { Footer } from "@/components/layout/footer";
import { Navbar } from "@/components/layout/navbar";
import { ASSAM_DISTRICTS } from "@/lib/assam-districts";
import { backendFetch } from "@/lib/backend-api";

const LAUNCH_STATE = "Assam";

export const metadata: Metadata = {
  title: "Find Freelancers — Porisrom",
};

const EXPERIENCE_RANGES = ["Less than 1 year", "1–2 years", "3–5 years", "5+ years"];

type Category = { id: string; name: string; slug: string };
type Skill = { id: string; name: string; categoryId: string | null };

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
  const keyword = typeof params.keyword === "string" ? params.keyword : undefined;
  const categoryId = typeof params.categoryId === "string" ? params.categoryId : undefined;
  const skillId = typeof params.skillId === "string" ? params.skillId : undefined;
  const district = typeof params.district === "string" ? params.district : undefined;
  const experienceLevel =
    typeof params.experienceLevel === "string" ? params.experienceLevel : undefined;
  const minRating = typeof params.minRating === "string" ? params.minRating : undefined;
  const verifiedOnly = params.verifiedOnly === "true";
  const page = typeof params.page === "string" ? Number(params.page) || 1 : 1;

  const [session, categories, skills, result] = await Promise.all([
    auth(),
    backendFetch<Category[]>("/categories").catch(() => null),
    backendFetch<Skill[]>("/skills").catch(() => null),
    backendFetch<SearchResult>(
      `/search/freelancers?${buildQueryString({
        keyword,
        categoryId,
        skillId,
        state: LAUNCH_STATE,
        district,
        experienceLevel,
        minRating,
        verifiedOnly: verifiedOnly ? "true" : undefined,
        page: String(page),
        pageSize: "12",
      })}`
    ).catch(() => null),
  ]);

  if (!categories || !skills || !result) {
    return <FreelancerDiscoveryError isAuthenticated={Boolean(
      session?.user?.id && session.accessToken && !session.error
    )} />;
  }

  const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize));
  const hasActiveFilters = Boolean(
    keyword || categoryId || skillId || district || experienceLevel || minRating || verifiedOnly || page > 1,
  );
  const activeFilterLabels = [
    keyword ? `Search: ${keyword}` : null,
    categoryId ? categories.find(({ id }) => id === categoryId)?.name ?? "Category" : null,
    skillId ? skills.find(({ id }) => id === skillId)?.name ?? "Skill" : null,
    district ? `${district}, Assam` : null,
    experienceLevel ?? null,
    minRating ? `${minRating}+ rating` : null,
    verifiedOnly ? "Verified only" : null,
  ].filter((label): label is string => Boolean(label));
  const pageHref = (nextPage: number) =>
    `/freelancers?${buildQueryString({
      keyword,
      categoryId,
      skillId,
      district,
      experienceLevel,
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
        <FreelancerDiscoveryTransition>
          <h1 className="font-display text-3xl font-semibold text-foreground">Find Freelancers</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {result.total} freelancer{result.total === 1 ? "" : "s"} found
          </p>

        <form data-discovery-form className="mt-6 grid grid-cols-1 gap-3 min-[430px]:grid-cols-2 md:grid-cols-4 lg:grid-cols-7" method="get">
          {minRating && <input type="hidden" name="minRating" value={minRating} />}
          <input
            type="search"
            name="keyword"
            defaultValue={keyword ?? ""}
            placeholder="Name, skill, or service"
            className="h-11 min-w-0 rounded-lg border border-input bg-transparent px-3 text-base text-foreground min-[430px]:col-span-2 md:col-span-2 md:text-sm lg:col-span-1"
          />
          <select
            name="categoryId"
            defaultValue={categoryId ?? ""}
            className="h-11 min-w-0 w-full rounded-lg border border-input bg-transparent px-3 text-base text-foreground md:text-sm"
          >
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <select
            name="skillId"
            defaultValue={skillId ?? ""}
            className="h-11 min-w-0 w-full rounded-lg border border-input bg-transparent px-3 text-base text-foreground md:text-sm"
          >
            <option value="">All skills</option>
            {skills.map((skill) => (
              <option key={skill.id} value={skill.id}>
                {skill.name}
              </option>
            ))}
          </select>
          <select
            name="district"
            defaultValue={district ?? ""}
            className="h-11 min-w-0 w-full rounded-lg border border-input bg-transparent px-3 text-base text-foreground md:text-sm"
          >
            <option value="">All Assam districts</option>
            {ASSAM_DISTRICTS.map((districtName) => (
              <option key={districtName} value={districtName}>
                {districtName}
              </option>
            ))}
          </select>
          <select
            name="experienceLevel"
            defaultValue={experienceLevel ?? ""}
            className="h-11 min-w-0 w-full rounded-lg border border-input bg-transparent px-3 text-base text-foreground md:text-sm"
          >
            <option value="">Any experience</option>
            {EXPERIENCE_RANGES.map((e) => (
              <option key={e} value={e}>
                {e}
              </option>
            ))}
          </select>
          <label className="flex h-11 min-w-0 items-center gap-2 rounded-lg border border-input px-3 text-sm text-foreground">
            <input className="size-4 shrink-0" type="checkbox" name="verifiedOnly" value="true" defaultChecked={verifiedOnly} />
            Verified only
          </label>
          <button
            type="submit"
            className="h-11 w-full rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
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
            <Link data-discovery-navigation href="/freelancers" className="ml-auto min-h-11 shrink-0 content-center px-2 text-sm font-medium text-primary hover:underline">
              Clear filters
            </Link>
          </div>
        )}

        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {result.items.map((item) => (
            <Link
              key={item.id}
              href={`/freelancers/${item.id}`}
              className="min-w-0 rounded-2xl border border-border bg-card p-4 transition-colors hover:border-primary/40 sm:p-5"
            >
              <div className="flex items-center justify-between gap-2">
                <h2 className="min-w-0 break-words font-semibold text-foreground">{item.user.name}</h2>
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
            <div className="col-span-full rounded-2xl border border-border bg-card p-8 text-center">
              <p className="text-sm text-muted-foreground">No freelancers match these filters yet.</p>
              <Link
                data-discovery-navigation
                href="/freelancers"
                className="mt-4 inline-flex h-10 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                Clear filters and view all
              </Link>
            </div>
          )}
        </div>

        {totalPages > 1 && (
          <nav className="mt-10 flex w-full items-center justify-between gap-2 text-sm sm:justify-center sm:gap-4" aria-label="Freelancer results pages">
            {page <= 1 ? (
              <span aria-disabled="true" className="flex min-h-11 flex-1 items-center justify-center rounded-lg border border-border px-3 py-2 text-muted-foreground opacity-50 sm:flex-none sm:px-4">
                Previous
              </span>
            ) : (
              <Link
                data-discovery-navigation
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
                data-discovery-navigation
                href={pageHref(page + 1)}
                className="flex min-h-11 flex-1 items-center justify-center rounded-lg border border-border px-3 py-2 font-medium text-foreground hover:border-primary/40 hover:text-primary sm:flex-none sm:px-4"
              >
                Next
              </Link>
            )}
          </nav>
        )}
        </FreelancerDiscoveryTransition>
      </main>

      <Footer />
    </div>
  );
}
