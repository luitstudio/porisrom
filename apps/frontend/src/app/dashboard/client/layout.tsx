import Link from "next/link";

import { auth } from "@/auth";
import { SignOutButton } from "@/components/dashboard/sign-out-button";

export default async function ClientDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  const roleLabel = session?.user.role === "freelancer" ? "Freelancer" : "Client";

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <Link href="/" className="font-display text-lg font-semibold text-foreground">
            Porisrom
          </Link>
          <div className="flex items-center gap-4">
            <Link
              href="/dashboard/client/messages"
              className="text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              Messages
            </Link>
            <span className="rounded-full bg-secondary px-3 py-1 text-xs font-medium text-foreground">
              {roleLabel}
            </span>
            <SignOutButton />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">{children}</main>
    </div>
  );
}
