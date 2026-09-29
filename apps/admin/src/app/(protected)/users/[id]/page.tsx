import Link from "next/link";

import { backendFetch } from "@/lib/backend-api";
import { requireSession } from "@/lib/session";

import { ModerationActions } from "./moderation-actions";

type CategoryRelation = { category: { id: string; name: string; slug: string } };
type ModerationProfile = {
  id: string;
  bio?: string | null;
  companyName?: string;
  about?: string | null;
  address?: string | null;
  state?: string | null;
  district?: string | null;
  experienceLevel?: string | null;
  logoUrl?: string | null;
  verificationStatus: string;
  isBadgeVerified: boolean;
  identityDocument?: { status: string; reviewedAt: string | null } | null;
  categories: CategoryRelation[];
  skills?: { skill: { id: string; name: string } }[];
  portfolioItems?: { id: string; title: string; type: string; url: string }[];
};
type ModerationDetail = { id: string; name: string; role: "freelancer" | "client"; status: string; isOnboarded: boolean; profile: ModerationProfile };

function Field({ label, value }: { label: string; value?: string | null }) {
  return <div><dt className="text-sm font-medium" style={{ color: "var(--muted)" }}>{label}</dt><dd className="mt-1 break-words">{value || "Not provided"}</dd></div>;
}

export default async function ProfileReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { accessToken } = await requireSession();
  const detail = await backendFetch<ModerationDetail>(`/admin/users/${id}/profile`, { accessToken });
  const identityDocument = detail.role === "freelancer" && detail.profile.identityDocument
    ? await backendFetch<{ url: string; expiresAt: number; status: string }>(`/admin/users/${id}/identity-document`, { accessToken }).catch(() => null)
    : null;
  const { profile } = detail;

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-5 overflow-hidden">
      <Link href="/users" className="inline-flex min-h-11 items-center self-start">← Back to users</Link>
      <section className="card flex flex-col gap-5 p-4 sm:p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0"><p className="text-sm capitalize" style={{ color: "var(--muted)" }}>{detail.role}</p><h1 className="break-words text-2xl font-semibold">{profile.companyName || detail.name}</h1></div>
          <span className="self-start rounded-full px-3 py-1 text-sm capitalize" style={{ border: "1px solid var(--border)" }}>{profile.verificationStatus}</span>
        </div>
        <dl className="grid gap-4 sm:grid-cols-2">
          <Field label="Account name" value={detail.name} />
          <Field label="Account status" value={detail.status} />
          <Field label="Onboarding" value={detail.isOnboarded ? "Complete" : "Incomplete"} />
          <Field label="Address" value={profile.address} />
          <Field label="State" value={profile.state} />
          {detail.role === "freelancer" ? <><Field label="District" value={profile.district} /><Field label="Experience" value={profile.experienceLevel} /><div className="sm:col-span-2"><Field label="Bio" value={profile.bio} /></div></> : <><Field label="Logo URL" value={profile.logoUrl} /><div className="sm:col-span-2"><Field label="Description" value={profile.about} /></div></>}
        </dl>
        <div><h2 className="font-medium">Categories</h2><div className="mt-2 flex flex-wrap gap-2">{profile.categories.length ? profile.categories.map(({ category }) => <span key={category.id} className="rounded-full px-3 py-1 text-sm" style={{ border: "1px solid var(--border)" }}>{category.name}</span>) : <span style={{ color: "var(--muted)" }}>None selected</span>}</div></div>
        {profile.skills && <div><h2 className="font-medium">Skills</h2><div className="mt-2 flex flex-wrap gap-2">{profile.skills.length ? profile.skills.map(({ skill }) => <span key={skill.id} className="rounded-full px-3 py-1 text-sm" style={{ border: "1px solid var(--border)" }}>{skill.name}</span>) : <span style={{ color: "var(--muted)" }}>None selected</span>}</div></div>}
        {profile.portfolioItems && <div><h2 className="font-medium">Portfolio</h2><ul className="mt-2 space-y-2">{profile.portfolioItems.length ? profile.portfolioItems.map(item => <li key={item.id}><a href={item.url} target="_blank" rel="noreferrer" className="inline-flex min-h-11 max-w-full items-center break-all underline">{item.title} ({item.type})</a></li>) : <li style={{ color: "var(--muted)" }}>No portfolio items</li>}</ul></div>}
        {detail.role === "freelancer" && <div><h2 className="font-medium">Identity Document Review</h2><p className="mt-1 text-sm capitalize" style={{ color: "var(--muted)" }}>{profile.identityDocument?.status ?? "Not submitted"}</p>{identityDocument && <a href={identityDocument.url} target="_blank" rel="noreferrer" className="mt-2 inline-flex min-h-11 items-center underline">View private document</a>}</div>}
        <ModerationActions userId={detail.id} status={profile.verificationStatus} identityDocumentStatus={profile.identityDocument?.status} />
      </section>
    </main>
  );
}
