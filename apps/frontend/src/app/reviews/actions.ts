"use server";

import { auth } from "@/auth";
import { BackendApiError, backendFetch } from "@/lib/backend-api";

export type ReviewItem = {
  id: string;
  rating: number;
  comment: string | null;
  createdAt: string;
  author: { id: string; name: string };
};

export type FreelancerReviewDashboard = {
  profileMissing?: boolean;
  ratingAvg: number;
  ratingCount: number;
  reviews: ReviewItem[];
};

export async function getFreelancerReviewDashboardAction(): Promise<FreelancerReviewDashboard> {
  const session = await auth();
  if (!session?.accessToken || session.user.role !== "freelancer") throw new Error("Not authenticated");
  let profile: { id: string; ratingAvg: number; ratingCount: number };
  try {
    profile = await backendFetch<{ id: string; ratingAvg: number; ratingCount: number }>("/freelancers/me", {
      accessToken: session.accessToken,
    });
  } catch (error) {
    if (error instanceof BackendApiError && error.status === 404) {
      return { profileMissing: true, ratingAvg: 0, ratingCount: 0, reviews: [] };
    }
    throw error;
  }
  const reviews = await backendFetch<ReviewItem[]>("/freelancers/me/reviews", {
    accessToken: session.accessToken,
  });
  return { ratingAvg: profile.ratingAvg, ratingCount: profile.ratingCount, reviews };
}
