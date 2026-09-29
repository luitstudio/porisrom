import { backendFetch } from "@/lib/backend-api";
import { requireSession } from "@/lib/session";
import Link from "next/link";

import { RowActions } from "./row-actions";

type Profile = {
  verificationStatus: string;
  isBadgeVerified: boolean;
  ratingAvg: number;
  ratingCount: number;
};

type AdminUserRow = {
  id: string;
  name: string;
  email: string;
  role: string | null;
  status: string;
  createdAt: string;
  freelancerProfile: Profile | null;
  companyProfile: Profile | null;
};

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ role?: string }>;
}) {
  const { role } = await searchParams;
  const { accessToken } = await requireSession();
  const query = role ? `?role=${encodeURIComponent(role)}` : "";
  const users = await backendFetch<AdminUserRow[]>(`/admin/users${query}`, { accessToken });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Users</h1>
        <form className="flex gap-2 text-sm">
          <select
            name="role"
            defaultValue={role ?? ""}
            className="rounded-md border px-2 py-1"
            style={{ borderColor: "var(--border)", background: "var(--background)" }}
          >
            <option value="">All roles</option>
            <option value="freelancer">Freelancer</option>
            <option value="client">Client</option>
            <option value="admin">Admin</option>
          </select>
          <button
            type="submit"
            className="rounded-md px-3 py-1"
            style={{ border: "1px solid var(--border)" }}
          >
            Filter
          </button>
        </form>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border)" }}>
              <th className="p-3">Name</th>
              <th className="p-3">Email</th>
              <th className="p-3">Role</th>
              <th className="p-3">Status</th>
              <th className="p-3">Verification</th>
              <th className="p-3">Rating</th>
              <th className="p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => {
              const profile = user.freelancerProfile ?? user.companyProfile;
              return (
                <tr key={user.id} style={{ borderBottom: "1px solid var(--border)" }}>
                  <td className="p-3">{user.name}</td>
                  <td className="p-3">{user.email}</td>
                  <td className="p-3">{user.role ?? "—"}</td>
                  <td className="p-3">{user.status}</td>
                  <td className="p-3">
                    {profile ? (
                      <span>
                        {profile.verificationStatus}
                        {profile.isBadgeVerified ? " · badge" : ""}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="p-3">
                    {profile && profile.ratingCount > 0
                      ? `${profile.ratingAvg.toFixed(1)} (${profile.ratingCount})`
                      : "—"}
                  </td>
                  <td className="p-3">
                    <div className="flex flex-wrap gap-2">
                      {profile && (user.role === "freelancer" || user.role === "client") && (
                        <Link
                          href={`/users/${user.id}`}
                          className="inline-flex min-h-11 items-center rounded px-3 py-2 font-medium"
                          style={{ border: "1px solid var(--border)" }}
                        >
                          Review profile
                        </Link>
                      )}
                      <RowActions
                        userId={user.id}
                        role={user.role}
                        hasProfile={Boolean(profile)}
                        verificationStatus={profile?.verificationStatus}
                        isBadgeVerified={profile?.isBadgeVerified}
                        status={user.status}
                      />
                    </div>
                  </td>
                </tr>
              );
            })}
            {users.length === 0 && (
              <tr>
                <td className="p-3" colSpan={7} style={{ color: "var(--muted)" }}>
                  No users match this filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
