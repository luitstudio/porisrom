import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { backendFetch, BackendApiError } from "./backend-api";

const ACCESS_COOKIE = "admin_access_token";
const REFRESH_COOKIE = "admin_refresh_token";

export type AdminUser = {
  id: string;
  name: string;
  email: string;
  role: string | null;
};

type AuthPayload = { user: AdminUser; accessToken: string; refreshToken: string };

export async function loginAdmin(email: string, password: string): Promise<void> {
  const data = await backendFetch<AuthPayload>("/auth/login", {
    method: "POST",
    body: { email, password },
  });
  if (data.user.role !== "admin") {
    throw new BackendApiError(403, "This account does not have admin access");
  }
  await setAuthCookies(data.accessToken, data.refreshToken);
}

export async function logoutAdmin(): Promise<void> {
  const store = await cookies();
  store.delete(ACCESS_COOKIE);
  store.delete(REFRESH_COOKIE);
}

async function setAuthCookies(accessToken: string, refreshToken: string) {
  const store = await cookies();
  const isProd = process.env.NODE_ENV === "production";
  store.set(ACCESS_COOKIE, accessToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: isProd,
    path: "/",
    maxAge: 15 * 60,
  });
  store.set(REFRESH_COOKIE, refreshToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: isProd,
    path: "/",
    maxAge: 7 * 24 * 60 * 60,
  });
}

async function tryRefresh(): Promise<string | null> {
  const store = await cookies();
  const refreshToken = store.get(REFRESH_COOKIE)?.value;
  if (!refreshToken) return null;

  try {
    const data = await backendFetch<AuthPayload>("/auth/refresh", {
      method: "POST",
      body: { refreshToken },
    });
    await setAuthCookies(data.accessToken, data.refreshToken);
    return data.accessToken;
  } catch {
    return null;
  }
}

/** Returns a valid access token + the current admin user, refreshing once if the access token expired. Returns null if there's no valid session at all. */
export async function getSession(): Promise<{ accessToken: string; user: AdminUser } | null> {
  const store = await cookies();
  let accessToken = store.get(ACCESS_COOKIE)?.value;

  if (!accessToken) {
    accessToken = (await tryRefresh()) ?? undefined;
    if (!accessToken) return null;
  }

  try {
    const user = await backendFetch<AdminUser>("/auth/me", { accessToken });
    if (user.role !== "admin") return null;
    return { accessToken, user };
  } catch (err) {
    if (err instanceof BackendApiError && err.status === 401) {
      const refreshed = await tryRefresh();
      if (!refreshed) return null;
      try {
        const user = await backendFetch<AdminUser>("/auth/me", { accessToken: refreshed });
        if (user.role !== "admin") return null;
        return { accessToken: refreshed, user };
      } catch {
        return null;
      }
    }
    return null;
  }
}

/** Same as getSession(), but redirects to /login instead of returning null. Use in pages/server actions that require an authenticated admin. */
export async function requireSession(): Promise<{ accessToken: string; user: AdminUser }> {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }
  return session;
}
