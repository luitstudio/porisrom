import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import { backendFetch, BackendApiError } from "./backend-api";
import { createRefreshCoordinator } from "./refresh-coordinator";

const ACCESS_COOKIE = "admin_access_token";
const REFRESH_COOKIE = "admin_refresh_token";

export type AdminUser = {
  id: string;
  name: string;
  email: string;
  role: string | null;
};

type AuthPayload = { user: AdminUser; accessToken: string; refreshToken: string };
const coordinateRefresh = createRefreshCoordinator<AuthPayload>();

export async function loginAdmin(email: string, password: string): Promise<void> {
  const data = await backendFetch<AuthPayload>("/auth/login", {
    method: "POST",
    body: { email, password },
  });
  if (data.user.role !== "admin") {
    await backendFetch("/auth/logout", { method: "POST", accessToken: data.accessToken, body: { refreshToken: data.refreshToken } });
    throw new BackendApiError(403, "This account does not have admin access");
  }
  await setAuthCookies(data.accessToken, data.refreshToken);
}

export async function logoutAdmin(): Promise<void> {
  const store = await cookies();
  const accessToken = store.get(ACCESS_COOKIE)?.value;
  const refreshToken = store.get(REFRESH_COOKIE)?.value;
  if (accessToken || refreshToken) {
    try { await backendFetch("/auth/logout", { method: "POST", accessToken, body: { refreshToken } }); }
    catch { throw new Error("Logout could not revoke your session. Please retry; your session cookies were retained."); }
  }
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

export async function refreshAdminSession(): Promise<void> {
  const store = await cookies();
  const refreshToken = store.get(REFRESH_COOKIE)?.value;
  if (!refreshToken) throw new BackendApiError(401, "Missing refresh credentials");
  const data = await coordinateRefresh(refreshToken, () => backendFetch<AuthPayload>("/auth/refresh", {
    method: "POST",
    body: { refreshToken },
  }));
  if (data.user.role !== "admin") throw new BackendApiError(403, "Admin access required");
  await setAuthCookies(data.accessToken, data.refreshToken);
}

async function redirectToRefresh(): Promise<never> {
  const path = (await headers()).get("x-porisrom-admin-path") ?? "/";
  redirect(`/api/auth/refresh?returnTo=${encodeURIComponent(path)}`);
}

/** Reads the session; expired credentials redirect to a route that can persist cookies. */
export async function getSession(): Promise<{ accessToken: string; user: AdminUser } | null> {
  const store = await cookies();
  const accessToken = store.get(ACCESS_COOKIE)?.value;

  if (!accessToken) {
    if (store.get(REFRESH_COOKIE)?.value) await redirectToRefresh();
    return null;
  }

  try {
    const user = await backendFetch<AdminUser>("/auth/me", { accessToken });
    if (user.role !== "admin") return null;
    return { accessToken, user };
  } catch (err) {
    if (err instanceof BackendApiError && err.status === 401) {
      if (store.get(REFRESH_COOKIE)?.value) await redirectToRefresh();
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
