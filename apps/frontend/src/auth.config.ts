import type { JWT } from "next-auth/jwt";
import type { NextAuthConfig } from "next-auth";

import { backendFetch } from "@/lib/backend-api";

const ACCESS_TOKEN_LIFETIME_MS = 15 * 60 * 1000; // matches backend JWT_ACCESS_EXPIRES_IN

async function refreshAccessToken(token: JWT): Promise<JWT> {
  try {
    const result = await backendFetch<{ accessToken: string; refreshToken: string }>(
      "/auth/refresh",
      { method: "POST", body: { refreshToken: token.refreshToken } },
    );

    return {
      ...token,
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      accessTokenExpires: Date.now() + ACCESS_TOKEN_LIFETIME_MS,
      error: undefined,
    };
  } catch {
    return { ...token, error: "RefreshFailed" };
  }
}

export const authConfig: NextAuthConfig = {
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
        token.accessTokenExpires = Date.now() + ACCESS_TOKEN_LIFETIME_MS;
      }

      if (trigger === "update" && session) {
        const update = session as Partial<{
          role: "freelancer" | "client" | "admin" | null;
          isOnboarded: boolean;
        }>;
        if (update.role !== undefined) token.role = update.role;
        if (update.isOnboarded !== undefined) token.isOnboarded = update.isOnboarded;
      }

      if (token.accessTokenExpires && Date.now() < token.accessTokenExpires) {
        return token;
      }

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
};
