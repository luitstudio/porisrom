import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { FreelancerSidebar } from "@/components/dashboard/freelancer/sidebar";
import { MobileTabBar } from "@/components/dashboard/freelancer/mobile-tab-bar";

export default async function FreelancerDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session) redirect("/auth/login");

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user) redirect("/auth/login");

  return (
    <div className="flex min-h-screen bg-background">
      <FreelancerSidebar name={user.name} completionPercent={user.profileCompleteness} />
      <div className="flex-1 pb-20 lg:pb-0">{children}</div>
      <MobileTabBar />
    </div>
  );
}
