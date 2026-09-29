import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { SignOutButton } from "@/components/dashboard/sign-out-button";
import { ClientMobileTabBar } from "@/components/dashboard/client/mobile-tab-bar";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { BrandLogo } from "@/components/common/brand-logo";
import { Badge } from "@/components/ui/badge";
import { getCurrentUser } from "@/lib/current-user";

export default async function ClientDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  const session = await auth();
  if (!user) redirect("/auth/login");
  if (!session?.accessToken) redirect("/auth/login");
  if (!user.role) redirect("/onboarding");
  if (user.role === "admin") redirect("/");
  if (user.role === "freelancer") redirect("/dashboard/freelancer");

  return (
    <div className="dark dashboard-theme client-theme min-h-screen overflow-x-clip bg-background">
      <header className="w-full overflow-x-clip border-b border-border bg-card shadow-[var(--shadow-subtle)]">
        <div className="mx-auto flex min-h-16 w-full min-w-0 max-w-6xl items-center justify-between gap-2 px-3 min-[375px]:px-4 sm:gap-3 sm:px-6 lg:px-8">
          <Link href="/" aria-label="Porisrom home" className="inline-flex min-h-11 min-w-0 shrink items-center">
            <BrandLogo priority className="h-6 max-w-28 sm:h-7 sm:max-w-40" />
          </Link>
          <div className="hidden items-center gap-3 sm:flex">
            <Link
              href="/dashboard/client/settings"
              className="inline-flex min-h-10 items-center rounded-[var(--radius-control)] px-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Profile settings
            </Link>
            <Link
              href="/dashboard/client/messages"
              className="inline-flex min-h-10 items-center rounded-[var(--radius-control)] px-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Messages
            </Link>
            <Link href="/dashboard/client/payments" className="inline-flex min-h-10 items-center rounded-[var(--radius-control)] px-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Payments</Link>
            <NotificationBell accessToken={session.accessToken} messagesHref="/dashboard/client/messages" />
            <Badge className="border-[var(--role-accent-border)] bg-[var(--role-accent-muted)] text-[var(--role-accent)]">Client</Badge>
            <SignOutButton />
          </div>
          <div className="flex shrink-0 items-center gap-0.5 sm:hidden">
            <NotificationBell accessToken={session.accessToken} messagesHref="/dashboard/client/messages" />
            <SignOutButton />
          </div>
        </div>
      </header>

      <main className="mx-auto box-border w-full min-w-0 max-w-6xl overflow-x-clip px-3 py-5 pb-24 [overflow-wrap:anywhere] min-[375px]:px-4 sm:px-6 sm:py-8 sm:pb-8 lg:px-8">
        {children}
      </main>

      <ClientMobileTabBar />
    </div>
  );
}
