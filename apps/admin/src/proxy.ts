import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const ACCESS_COOKIE = "admin_access_token";
const REFRESH_COOKIE = "admin_refresh_token";

// Cheap presence check only — actual validity/expiry is handled per-request by
// requireSession() in server components/actions, which also refreshes when needed.
export default function proxy(request: NextRequest) {
  const isLoginPage = request.nextUrl.pathname === "/login";
  const hasSession =
    request.cookies.has(ACCESS_COOKIE) || request.cookies.has(REFRESH_COOKIE);

  if (!hasSession && !isLoginPage) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  if (hasSession && isLoginPage) {
    return NextResponse.redirect(new URL("/", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
