import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { FreelancerSidebar } from "@/components/dashboard/freelancer/sidebar";
import { MobileTabBar } from "@/components/dashboard/freelancer/mobile-tab-bar";
import { getCurrentUser } from "@/lib/current-user";

export default async function FreelancerDashboardLayout({
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
  if (user.role === "client") redirect("/dashboard/client");

  return (
    <div className="dark dashboard-theme freelancer-theme flex min-h-screen min-w-0 overflow-x-clip bg-background">
      <FreelancerSidebar name={user.name} completionPercent={user.profileCompleteness} accessToken={session.accessToken} />
      <div className="w-0 min-w-0 flex-1 pb-24 lg:pb-0">{children}</div>
      <MobileTabBar accessToken={session.accessToken} />
    </div>
  );
}
