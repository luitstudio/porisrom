import { redirect } from "next/navigation";

import { auth } from "@/auth";

export default async function DashboardPage() {
  const session = await auth();
  if (!session) redirect("/auth/login");
  if (!session.user.role) redirect("/onboarding");

  redirect(
    session.user.role === "freelancer" ? "/dashboard/freelancer" : "/dashboard/client"
  );
}
