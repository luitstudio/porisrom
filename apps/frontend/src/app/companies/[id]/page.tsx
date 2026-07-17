import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { auth } from "@/auth";
import { BackendApiError, backendFetch } from "@/lib/backend-api";
import {
  ConnectionActionPanel,
  type ConnectionSummary,
} from "@/components/connections/connection-action-panel";
import { Footer } from "@/components/layout/footer";
import { Navbar } from "@/components/layout/navbar";

type CompanyProfile = {
  id: string;
  userId: string;
  companyName: string;
  about: string | null;
  address: string | null;
  state: string | null;
  isBadgeVerified: boolean;
  ratingAvg: number;
  ratingCount: number;
  user: { name: string };
  categories: { category: { id: string; name: string } }[];
};

async function getProfile(id: string): Promise<CompanyProfile | null> {
  try {
    return await backendFetch<CompanyProfile>(`/companies/${id}`);
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
  return { title: profile ? `${profile.companyName} — Porisrom` : "Company — Porisrom" };
}

export default async function CompanyProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [session, profile] = await Promise.all([auth(), getProfile(id)]);
  if (!profile) notFound();

  const isAuthenticated = Boolean(session);

  // Only a logged-in Freelancer can connect with a Company — fetch the viewer's
  // connections to find any existing relationship with this profile's owner.
  let connection: ConnectionSummary | null = null;
  if (
    session?.accessToken &&
    session.user.role === "freelancer" &&
    session.user.id !== profile.userId
  ) {
    const myConnections = await backendFetch<ConnectionSummary[]>("/connections", {
      accessToken: session.accessToken,
    });
    connection =
      myConnections.find(
        (c) =>
          (c.requesterId === session.user.id && c.receiverId === profile.userId) ||
          (c.requesterId === profile.userId && c.receiverId === session.user.id)
      ) ?? null;
  }

  return (
    <div className="flex flex-1 flex-col">
      <Navbar isAuthenticated={isAuthenticated} />

      <main className="mx-auto w-full max-w-4xl flex-1 px-5 pt-28 pb-16 sm:px-8 sm:pt-32">
        <Link href="/companies" className="text-sm text-muted-foreground hover:text-foreground">
          &larr; Back to Find Companies
        </Link>

        <div className="mt-4 flex items-center gap-3">
          <h1 className="font-display text-3xl font-semibold text-foreground">
            {profile.companyName}
          </h1>
          {profile.isBadgeVerified && (
            <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              Verified
            </span>
          )}
        </div>
        {profile.state && <p className="mt-1 text-sm text-muted-foreground">{profile.state}</p>}

        {session?.user.role === "freelancer" && (
          <ConnectionActionPanel
            viewerUserId={session.user.id}
            profileUserId={profile.userId}
            connection={connection}
            currentPath={`/companies/${profile.id}`}
            messagesBasePath="/dashboard/freelancer/messages"
          />
        )}

        <p className="mt-4 text-sm text-muted-foreground">
          Rating: {profile.ratingCount > 0 ? `${profile.ratingAvg.toFixed(1)} (${profile.ratingCount})` : "No reviews yet"}
        </p>

        {profile.about && (
          <p className="mt-6 whitespace-pre-line text-sm text-foreground">{profile.about}</p>
        )}

        {profile.categories.length > 0 && (
          <div className="mt-6">
            <h2 className="text-sm font-semibold text-foreground">Hiring categories</h2>
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
      </main>

      <Footer />
    </div>
  );
}
