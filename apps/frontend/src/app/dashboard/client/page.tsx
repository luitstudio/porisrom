import { redirect } from "next/navigation";

import { ProfileCompletionBanner } from "@/components/dashboard/profile-completion-banner";
import { getCurrentUser } from "@/lib/current-user";

export default async function ClientDashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/auth/login");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-foreground sm:text-3xl">
          Welcome back, {user.name.split(" ")[0]}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Here&apos;s what&apos;s happening with your hiring.
        </p>
      </div>

      <ProfileCompletionBanner percent={user.profileCompleteness} ctaHref="/onboarding" />

      <div className="rounded-2xl border border-border bg-card p-6">
        <h2 className="text-sm font-semibold text-foreground">Your account</h2>
        <dl className="mt-4 flex flex-col gap-3 text-sm">
          <div className="flex items-center justify-between">
            <dt className="text-muted-foreground">Name</dt>
            <dd className="font-medium text-foreground">{user.name}</dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-muted-foreground">Email</dt>
            <dd className="font-medium text-foreground">{user.email}</dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-muted-foreground">Role</dt>
            <dd className="font-medium text-foreground">Client</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
