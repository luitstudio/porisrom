import type { JWT } from "next-auth/jwt";
import type { NextAuthConfig } from "next-auth";

import { backendFetch, BackendApiError } from "@/lib/backend-api";
import { createRefreshCoordinator } from "@/lib/refresh-coordinator";

const coordinateRefresh = createRefreshCoordinator<{ accessToken: string; refreshToken: string }>();

const ACCESS_TOKEN_LIFETIME_MS = 15 * 60 * 1000; // matches backend JWT_ACCESS_EXPIRES_IN
function accessExpiry(token: string) {
  try {
    const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString());
    if (typeof payload.exp === "number") return payload.exp * 1000;
  } catch { /* Synthetic/legacy responses use the existing fallback. */ }
  return Date.now() + ACCESS_TOKEN_LIFETIME_MS;
}

async function refreshAccessToken(token: JWT): Promise<JWT> {
  try {
    const result = await coordinateRefresh(token.refreshToken, () => backendFetch<{ accessToken: string; refreshToken: string }>(
      "/auth/refresh",
      { method: "POST", body: { refreshToken: token.refreshToken } },
    ));

    return {
      ...token,
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      accessTokenExpires: accessExpiry(result.accessToken),
      error: undefined,
    };
  } catch (error) {
    if (error instanceof BackendApiError && error.status === 409) return { ...token, error: "RefreshPending" };
    return { ...token, error: "RefreshFailed" };
  }
}

export function createAuthConfig(allowRefresh = true): NextAuthConfig { return {
  pages: {
    signIn: "/auth/login",
  },
  session: {
    strategy: "jwt",
  },
  providers: [],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id as string;
        token.role = (user.role ?? null) as "freelancer" | "client" | "admin" | null;
        token.isOnboarded = user.isOnboarded as boolean;
        token.accessToken = user.accessToken as string;
        token.refreshToken = user.refreshToken as string;
        token.accessTokenExpires = accessExpiry(user.accessToken as string);
      }

      if (trigger === "update" && session) {
        const update = session as Partial<{
          role: "freelancer" | "client" | "admin" | null;
          isOnboarded: boolean;
        }>;
        if (update.role !== undefined) token.role = update.role;
        if (update.isOnboarded !== undefined) token.isOnboarded = update.isOnboarded;
      }

      if (token.accessTokenExpires && Date.now() < token.accessTokenExpires - (allowRefresh ? 30000 : 0)) {
        return token;
      }

      if (!allowRefresh) return { ...token, error: "RefreshPending" };
      return refreshAccessToken(token);
    },
    async session({ session, token }) {
      session.user.id = token.id as string;
      session.user.role = token.role as "freelancer" | "client" | "admin" | null;
      session.user.isOnboarded = token.isOnboarded as boolean;
      session.accessToken = token.accessToken as string;
      if (token.error) session.error = token.error;
      return session;
    },
  },
}; }

export const authConfig = createAuthConfig();
