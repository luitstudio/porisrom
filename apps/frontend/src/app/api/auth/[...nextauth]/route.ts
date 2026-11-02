import { handlers } from "@/auth";
import { revokeMarketplaceSession } from "@/lib/logout-session";
import { createHash, timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const response = await handlers.GET(request);
  if (new URL(request.url).pathname.endsWith("/session")) {
    const data = await response.clone().json().catch(() => null);
    if (data?.error === "RefreshPending") {
      // Keep a retryable session in SessionProvider rather than turning a losing
      // request into a permanent signed-out state. Never send its stale cookie.
      return Response.json(data, { headers: { "Retry-After": "1", "Cache-Control": "no-store" } });
    }
  }
  return response;
}

export async function POST(request: NextRequest) {
  if (new URL(request.url).pathname.endsWith("/signout")) {
    // Verify Auth.js CSRF before revocation; Auth.js still owns cookie clearing.
    const form = await request.clone().formData();
    const csrfCookie = request.headers.get("cookie")?.split(/;\s*/).find(value => /^(?:__Host-)?authjs\.csrf-token=/.test(value));
    let expected: string | undefined;
    let signature: string | undefined;
    try { [expected, signature] = csrfCookie ? decodeURIComponent(csrfCookie.slice(csrfCookie.indexOf("=") + 1)).split("|") : []; } catch { /* Invalid cookie. */ }
    const digest = process.env.AUTH_SECRET && expected ? createHash("sha256").update(`${expected}${process.env.AUTH_SECRET}`).digest("hex") : "";
    if (!expected || form.get("csrfToken") !== expected || !signature || signature.length !== digest.length || !timingSafeEqual(Buffer.from(signature), Buffer.from(digest))) {
      return Response.json({ message: "Invalid CSRF token" }, { status: 403 });
    }
    try { await revokeMarketplaceSession(request.headers); }
    catch { return Response.json({ message: "Session revocation failed. Retry logout." }, { status: 503 }); }
  }
  return handlers.POST(request);
}
