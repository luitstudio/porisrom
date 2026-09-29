import { auth } from "@/auth";
import { backendFetch } from "@/lib/backend-api";

export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  role: "freelancer" | "client" | "admin" | null;
  isOnboarded: boolean;
  profileCompleteness: number;
};

function resolveProfileCompleteness(user: CurrentUser) {
  if (user.isOnboarded) return 100;
  return Math.max(0, Math.min(100, user.profileCompleteness));
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const session = await auth();
  if (!session?.accessToken) return null;

  try {
    const user = await backendFetch<CurrentUser>("/auth/me", { accessToken: session.accessToken });
    return { ...user, profileCompleteness: resolveProfileCompleteness(user) };
  } catch {
    return null;
  }
}
