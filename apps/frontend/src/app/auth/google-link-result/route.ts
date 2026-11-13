import { NextRequest, NextResponse } from "next/server";

import {
  GOOGLE_LINK_INTENT_COOKIE,
  type GoogleLinkReturnPath,
  verifyGoogleLinkIntent,
} from "@/lib/google-link-intent";

const RESULTS = new Set(["linked", "identity_in_use", "email_mismatch", "inactive", "invalid_identity", "session_changed", "expired_or_invalid", "unavailable"]);

export function GET(request: NextRequest) {
  const intent = verifyGoogleLinkIntent(request.cookies.get(GOOGLE_LINK_INTENT_COOKIE)?.value);
  const returnPath: GoogleLinkReturnPath = intent?.returnPath ?? "/dashboard/freelancer/settings";
  const result = request.nextUrl.searchParams.get("result") ?? "unavailable";
  const safeResult = RESULTS.has(result) ? result : "unavailable";
  const response = NextResponse.redirect(new URL(`${returnPath}?googleLink=${safeResult}`, request.url));
  response.cookies.set(GOOGLE_LINK_INTENT_COOKIE, "", { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 0, path: "/" });
  return response;
}
