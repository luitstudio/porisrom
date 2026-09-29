import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/current-user";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/auth/login");
  if (!user.role) redirect("/onboarding");
  if (user.role === "admin") redirect("/");

  redirect(user.role === "freelancer" ? "/dashboard/freelancer" : "/dashboard/client");
}
