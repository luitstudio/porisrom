import { getToken } from "next-auth/jwt";
import { backendFetch } from "@/lib/backend-api";

export async function revokeMarketplaceSession(headers: Headers) {
  const token = await getToken({ req: { headers }, secret: process.env.AUTH_SECRET,
    secureCookie: (headers.get("cookie") ?? "").includes("__Secure-authjs.session-token") });
  if (!token) {
    if (/authjs\.session-token/.test(headers.get("cookie") ?? "")) {
      throw new Error("Cannot verify this session for logout. Backend revocation was not confirmed.");
    }
    return; // There is no local signed-in session to revoke.
  }
  try {
    await backendFetch("/auth/logout", { method: "POST", accessToken: token.accessToken,
      body: { refreshToken: token.refreshToken } });
  } catch {
    throw new Error("Logout could not revoke your session. Please retry; your session cookies were retained.");
  }
}
