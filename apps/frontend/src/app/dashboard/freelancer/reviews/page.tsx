import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { getFreelancerReviewDashboardAction } from "@/app/reviews/actions";
import { ReviewsDashboard } from "@/components/dashboard/freelancer/reviews-dashboard";

export default async function ReviewsPage() {
  const session = await auth();
  if (!session?.accessToken || session.user.role !== "freelancer") redirect("/auth/login");
  return <ReviewsDashboard initialData={await getFreelancerReviewDashboardAction()} />;
}
