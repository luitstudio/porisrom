import NextAuth from "next-auth";
import { NextResponse, type NextRequest, type NextFetchEvent } from "next/server";

import { authConfig } from "@/auth.config";
import { backendFetch } from "@/lib/backend-api";

const { auth } = NextAuth(authConfig);

function dashboardPathFor(role: "freelancer" | "client" | "admin" | null) {
  // Admins have no workflow inside apps/frontend — the real admin console is
  // the separate apps/admin app (Phase 9), so just send them to the homepage.
  if (role === "admin") return "/";
  if (role === "freelancer") return "/dashboard/freelancer";
  if (role === "client") return "/dashboard/client";
  return "/onboarding";
}

const authenticatedProxy = auth(async (req) => {
  const { nextUrl } = req;
  const session = req.auth?.error === "RefreshFailed" ? null : req.auth;
  const { pathname } = nextUrl;
  if (session?.error === "RefreshPending") return NextResponse.json({ message: "Session refresh in progress. Retry shortly." }, { status: 409, headers: { "Retry-After": "1" } });

  const isAuthPage = pathname.startsWith("/auth");
  const isOnboardingPage = pathname.startsWith("/onboarding");
  const isDashboardPage = pathname.startsWith("/dashboard");

  if (!session?.user) {
    if (isDashboardPage || isOnboardingPage) {
      const loginUrl = new URL("/auth/login", nextUrl);
      loginUrl.searchParams.set("from", pathname);
      return NextResponse.redirect(loginUrl);
    }
    return NextResponse.next();
  }

  const { role, isOnboarded } = session.user;

  if (isAuthPage) {
    try { await backendFetch("/auth/me", { accessToken: session.accessToken }); }
    catch { return NextResponse.next(); }
    const target = isOnboarded ? dashboardPathFor(role) : "/onboarding";
    return NextResponse.redirect(new URL(target, nextUrl));
  }

  if (isDashboardPage) {
    // The backend owns the authoritative role. This prevents a stale Auth.js
    // JWT role from bouncing the user between the two dashboard roots.
    let authoritative: { role: "freelancer" | "client" | "admin" | null; isOnboarded: boolean };
    try {
      authoritative = await backendFetch<typeof authoritative>("/auth/me", { accessToken: session.accessToken });
    } catch {
      // Preserve the route while the bounded server gate renders a retryable
      // state; a transient backend failure must not force a sign-out.
      return NextResponse.next();
    }
    if (authoritative.role === "admin") {
      return NextResponse.redirect(new URL("/", nextUrl));
    }
    if (!authoritative.isOnboarded) {
      return NextResponse.redirect(new URL("/onboarding", nextUrl));
    }
    const expectedDashboard = dashboardPathFor(authoritative.role);
    if (authoritative.role === null) {
      return NextResponse.redirect(new URL(expectedDashboard, nextUrl));
    }
    if (!pathname.startsWith(expectedDashboard)) {
      return NextResponse.redirect(new URL(expectedDashboard, nextUrl));
    }
  }

  return NextResponse.next();
});

export default async function proxy(request: NextRequest, event: NextFetchEvent) {
  // Auth.js types this wrapper as a route handler although its runtime also
  // supports Next proxy events; retain the real event for middleware execution.
  const response = await authenticatedProxy(request, event as unknown as Parameters<typeof authenticatedProxy>[1]);
  if (!response) return response;
  if (response.status === 409) {
    // Never overwrite the winner's cookie with a losing request's stale JWT.
    response.headers.delete("set-cookie");
    return response;
  }
  if (response.headers.has("location")) return response;
  const changes = response.headers.getSetCookie().map(value => value.split(";", 1)[0]);
  if (!changes.some(value => value.includes("authjs.session-token"))) return response;
  const headers = new Headers(request.headers);
  const cookies = new Map((headers.get("cookie") ?? "").split(/;\s*/).filter(Boolean).map(value => {
    const index = value.indexOf("="); return [value.slice(0, index), value.slice(index + 1)];
  }));
  for (const key of cookies.keys()) if (key.includes("authjs.session-token")) cookies.delete(key);
  for (const value of changes) {
    const index = value.indexOf("=");
    if (value.slice(index + 1)) cookies.set(value.slice(0, index), value.slice(index + 1));
  }
  headers.set("cookie", [...cookies].map(([key, value]) => `${key}=${value}`).join("; "));
  const forwarded = NextResponse.next({ request: { headers } });
  for (const [key, value] of response.headers) if (key !== "set-cookie") forwarded.headers.set(key, value);
  for (const value of response.headers.getSetCookie()) forwarded.headers.append("set-cookie", value);
  return forwarded;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
