import NextAuth from "next-auth";
import { NextResponse } from "next/server";

import { authConfig } from "@/auth.config";

const { auth } = NextAuth(authConfig);

function dashboardPathFor(role: "freelancer" | "client" | "admin" | null) {
  // Admins have no workflow inside apps/frontend — the real admin console is
  // the separate apps/admin app (Phase 9), so just send them to the homepage.
  if (role === "admin") return "/";
  if (role === "freelancer") return "/dashboard/freelancer";
  if (role === "client") return "/dashboard/client";
  return "/onboarding";
}

export default auth((req) => {
  const { nextUrl } = req;
  const session = req.auth;
  const { pathname } = nextUrl;

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
    const target = isOnboarded ? dashboardPathFor(role) : "/onboarding";
    return NextResponse.redirect(new URL(target, nextUrl));
  }

  if (isDashboardPage && role === "admin") {
    return NextResponse.redirect(new URL("/", nextUrl));
  }

  if (isDashboardPage && !isOnboarded) {
    return NextResponse.redirect(new URL("/onboarding", nextUrl));
  }

  if (isDashboardPage) {
    const expectedDashboard = dashboardPathFor(role);
    if (role === null) {
      return NextResponse.redirect(new URL(expectedDashboard, nextUrl));
    }
    if (role === "client" && pathname.startsWith("/dashboard/freelancer")) {
      return NextResponse.redirect(new URL(expectedDashboard, nextUrl));
    }
    if (role === "freelancer" && pathname.startsWith("/dashboard/client")) {
      return NextResponse.redirect(new URL(expectedDashboard, nextUrl));
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
