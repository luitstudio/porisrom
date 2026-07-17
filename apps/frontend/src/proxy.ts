import NextAuth from "next-auth";
import { NextResponse } from "next/server";

import { authConfig } from "@/auth.config";

const { auth } = NextAuth(authConfig);

function dashboardPathFor(role: "freelancer" | "client" | "admin" | null) {
  if (role === "admin") return "/admin/payments";
  return role === "freelancer" ? "/dashboard/freelancer" : "/dashboard/client";
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

  if (isDashboardPage && !isOnboarded) {
    return NextResponse.redirect(new URL("/onboarding", nextUrl));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
