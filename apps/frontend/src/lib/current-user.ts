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

export type CurrentUserOptions = { signal?: AbortSignal; throwOnFailure?: boolean };

export type CurrentUserContext = { user: CurrentUser | null; accessToken: string | null };

export async function getCurrentUserContext(options: CurrentUserOptions = {}): Promise<CurrentUserContext> {
  try {
    const session = await auth();
    if (!session?.accessToken) return { user: null, accessToken: null };
    const user = await backendFetch<CurrentUser>("/auth/me", { accessToken: session.accessToken, signal: options.signal });
    return { user: { ...user, profileCompleteness: resolveProfileCompleteness(user) }, accessToken: session.accessToken };
  } catch {
    if (options.throwOnFailure) throw new Error("Current user request failed");
    return { user: null, accessToken: null };
  }
}

export async function getCurrentUser(options: CurrentUserOptions = {}): Promise<CurrentUser | null> {
  return (await getCurrentUserContext(options)).user;
}
