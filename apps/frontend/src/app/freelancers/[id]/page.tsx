import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { auth } from "@/auth";
import { BackendApiError, backendFetch } from "@/lib/backend-api";
import { Footer } from "@/components/layout/footer";
import { Navbar } from "@/components/layout/navbar";

type FreelancerProfile = {
  id: string;
  bio: string | null;
  address: string | null;
  state: string | null;
  district: string | null;
  languages: string[];
  experienceLevel: string | null;
  isBadgeVerified: boolean;
  ratingAvg: number;
  ratingCount: number;
  user: { name: string };
  categories: { category: { id: string; name: string } }[];
  skills: { skill: { id: string; name: string } }[];
  portfolioItems: { id: string; title: string; type: string; url: string; description: string | null }[];
};

async function getProfile(id: string): Promise<FreelancerProfile | null> {
  try {
    return await backendFetch<FreelancerProfile>(`/freelancers/${id}`);
  } catch (err) {
    if (err instanceof BackendApiError && err.status === 404) return null;
    throw err;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const profile = await getProfile(id);
  return { title: profile ? `${profile.user.name} — Porisrom` : "Freelancer — Porisrom" };
}

export default async function FreelancerProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [session, profile] = await Promise.all([auth(), getProfile(id)]);
  if (!profile) notFound();

  const isAuthenticated = Boolean(session);
  const location = [profile.district, profile.state].filter(Boolean).join(", ");

  return (
    <div className="flex flex-1 flex-col">
      <Navbar isAuthenticated={isAuthenticated} />

      <main className="mx-auto w-full max-w-4xl flex-1 px-5 pt-28 pb-16 sm:px-8 sm:pt-32">
        <Link href="/freelancers" className="text-sm text-muted-foreground hover:text-foreground">
          &larr; Back to Find Freelancers
        </Link>

        <div className="mt-4 flex items-center gap-3">
          <h1 className="font-display text-3xl font-semibold text-foreground">
            {profile.user.name}
          </h1>
          {profile.isBadgeVerified && (
            <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              Verified
            </span>
          )}
        </div>
        {location && <p className="mt-1 text-sm text-muted-foreground">{location}</p>}

        <div className="mt-4 flex flex-wrap gap-4 text-sm text-muted-foreground">
          {profile.experienceLevel && <span>Experience: {profile.experienceLevel}</span>}
          <span>
            Rating: {profile.ratingCount > 0 ? `${profile.ratingAvg.toFixed(1)} (${profile.ratingCount})` : "No reviews yet"}
          </span>
          {profile.languages.length > 0 && <span>Languages: {profile.languages.join(", ")}</span>}
        </div>

        {profile.bio && (
          <p className="mt-6 whitespace-pre-line text-sm text-foreground">{profile.bio}</p>
        )}

        {profile.categories.length > 0 && (
          <div className="mt-6">
            <h2 className="text-sm font-semibold text-foreground">Categories</h2>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {profile.categories.map((c) => (
                <span
                  key={c.category.id}
                  className="rounded-full bg-accent px-2.5 py-1 text-xs text-accent-foreground"
                >
                  {c.category.name}
                </span>
              ))}
            </div>
          </div>
        )}

        {profile.skills.length > 0 && (
          <div className="mt-6">
            <h2 className="text-sm font-semibold text-foreground">Skills</h2>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {profile.skills.map((s) => (
                <span
                  key={s.skill.id}
                  className="rounded-full border border-border px-2.5 py-1 text-xs text-foreground"
                >
                  {s.skill.name}
                </span>
              ))}
            </div>
          </div>
        )}

        {profile.portfolioItems.length > 0 && (
          <div className="mt-6">
            <h2 className="text-sm font-semibold text-foreground">Portfolio</h2>
            <ul className="mt-2 flex flex-col gap-2">
              {profile.portfolioItems.map((item) => (
                <li key={item.id}>
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm text-primary hover:underline"
                  >
                    {item.title}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
