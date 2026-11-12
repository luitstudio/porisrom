import { redirect } from "next/navigation";

import { FreelancerDashboardGateError } from "@/components/dashboard/freelancer/dashboard-gate-error";
import { FreelancerSidebar } from "@/components/dashboard/freelancer/sidebar";
import { MobileTabBar } from "@/components/dashboard/freelancer/mobile-tab-bar";
import { CurrentUserGateUnavailableError } from "@/lib/bounded-current-user";
import { getFreelancerDashboardGate } from "@/lib/freelancer-dashboard-user";

export default async function FreelancerDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let gate;
  try {
    gate = await getFreelancerDashboardGate();
  } catch (error) {
    if (error instanceof CurrentUserGateUnavailableError) return <FreelancerDashboardGateError />;
    throw error;
  }
  const { user, accessToken } = gate;
  if (!user) redirect("/auth/login");
  if (!accessToken) redirect("/auth/login");
  if (!user.role) redirect("/onboarding");
  if (user.role === "admin") redirect("/");
  if (user.role === "client") redirect("/dashboard/client");

  return (
    <div className="dark dashboard-theme freelancer-theme flex min-h-screen min-w-0 overflow-x-clip bg-background">
      <FreelancerSidebar name={user.name} completionPercent={user.profileCompleteness} accessToken={accessToken} />
      <div className="w-0 min-w-0 flex-1 pb-24 lg:pb-0">{children}</div>
      <MobileTabBar accessToken={accessToken} />
    </div>
  );
}
