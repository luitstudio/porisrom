import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { BackendApiError } from "@/lib/backend-api";
import { refreshAdminSession } from "@/lib/session";
import { sessionReturnUrl } from "@/lib/session-return-url";

export async function GET(request: Request) {
  try {
    await refreshAdminSession();
    const target = new URL(request.url).searchParams.get("returnTo") ?? "/";
    return NextResponse.redirect(sessionReturnUrl(request.url, target));
  } catch (error) {
    if (error instanceof BackendApiError && [401, 403].includes(error.status)) {
      const store = await cookies();
      store.delete("admin_access_token"); store.delete("admin_refresh_token");
      return NextResponse.redirect(new URL("/login", request.url));
    }
    return NextResponse.json({ message: "Session refresh unavailable. Please retry." }, { status: 503, headers: { "Retry-After": "1" } });
  }
}
