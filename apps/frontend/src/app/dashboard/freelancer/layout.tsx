import { redirect } from "next/navigation";

import { FreelancerSidebar } from "@/components/dashboard/freelancer/sidebar";
import { MobileTabBar } from "@/components/dashboard/freelancer/mobile-tab-bar";
import { getCurrentUser } from "@/lib/current-user";

export default async function FreelancerDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/auth/login");

  return (
    <div className="flex min-h-screen bg-background">
      <FreelancerSidebar name={user.name} completionPercent={user.profileCompleteness} />
      <div className="flex-1 pb-20 lg:pb-0">{children}</div>
      <MobileTabBar />
    </div>
  );
}
