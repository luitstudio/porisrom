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

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const session = await auth();
  if (!session?.accessToken) return null;

  try {
    return await backendFetch<CurrentUser>("/auth/me", { accessToken: session.accessToken });
  } catch {
    return null;
  }
}
