import NextAuth from "next-auth";
import { getToken } from "next-auth/jwt";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";

import { createAuthConfig } from "@/auth.config";
import { backendFetch, BackendApiError } from "@/lib/backend-api";
import { classifyGoogleExchangeFailure, googleDiagnosticLogPayload } from "@/lib/google-auth-diagnostics";
import { googleLinkCompletionPath, resolveGoogleLinkCallback } from "@/lib/google-link-intent";
import { GOOGLE_OIDC_CHECKS } from "@/lib/google-oidc-security";
import { writeLocalGoogleAuthDiagnostic } from "@/lib/local-google-auth-diagnostics";

type LoginResponse = {
  user: {
    id: string;
    name: string;
    email: string;
    role: "freelancer" | "client" | "admin" | null;
    isOnboarded: boolean;
    profileCompleteness: number;
  };
  accessToken: string;
  refreshToken: string;
};

export const { handlers, auth, signIn, signOut } = NextAuth((request) => ({
  ...createAuthConfig(Boolean(request)),
  providers: [
    Credentials({
      credentials: {
        email: {},
        password: {},
      },
      async authorize(credentials) {
        const email = credentials?.email;
        const password = credentials?.password;

        if (typeof email !== "string" || typeof password !== "string") {
          return null;
        }

        try {
          const result = await backendFetch<LoginResponse>("/auth/login", {
            method: "POST",
            body: { email: email.toLowerCase(), password },
          });

          return {
            id: result.user.id,
            name: result.user.name,
            email: result.user.email,
            role: result.user.role,
            isOnboarded: result.user.isOnboarded,
            accessToken: result.accessToken,
            refreshToken: result.refreshToken,
          };
        } catch {
          console.error("Backend login failed during authorize()");
          return null;
        }
      },
    }),
    Google({ checks: [...GOOGLE_OIDC_CHECKS] }),
  ],
  callbacks: {
    ...createAuthConfig(Boolean(request)).callbacks,
    async signIn({ user, account }) {
      if (account?.provider !== "google") return true;
      const linkIntentCookie = request?.headers.get("cookie")?.split(";")
        .map((value) => value.trim().split("=", 2))
        .find(([name]) => name === "porisrom_google_link_intent")?.[1];
      const authToken = linkIntentCookie
        ? await getToken({ req: { headers: request!.headers }, secret: process.env.AUTH_SECRET })
        : null;
      const linkFlow = resolveGoogleLinkCallback(linkIntentCookie, authToken?.accessToken);
      if (linkFlow.kind === "result") return googleLinkCompletionPath(linkFlow.result);
      if (linkFlow.kind === "link") {
        if (!account.id_token) return googleLinkCompletionPath("invalid_identity");
        try {
          await backendFetch("/auth/google/link", { method: "POST", accessToken: authToken?.accessToken as string, body: { idToken: account.id_token, linkIntentNonce: linkFlow.intent.nonce } });
          return googleLinkCompletionPath("linked");
        } catch (error) {
          if (error instanceof BackendApiError) {
            if (error.status === 409 && error.message === "This Google account is linked to another user") return googleLinkCompletionPath("identity_in_use");
            if (error.status === 409 && error.message === "Google email must match the signed-in account email") return googleLinkCompletionPath("email_mismatch");
            if (error.status === 403 && error.message === "Account is not active") return googleLinkCompletionPath("inactive");
            if (error.status === 401) return googleLinkCompletionPath("invalid_identity");
          }
          return googleLinkCompletionPath("unavailable");
        }
      }
      if (!account.id_token) {
        const diagnostic = { event: "google_identity_token_missing" } as const;
        console.warn(JSON.stringify(diagnostic));
        await writeLocalGoogleAuthDiagnostic(diagnostic);
        return false;
      }
      const signupIntent = request?.headers.get("cookie")?.split(";")
        .map((value) => value.trim().split("=", 2))
        .find(([name]) => name === "porisrom_google_signup_intent")?.[1];
      try {
        const result = await backendFetch<LoginResponse>("/auth/google", {
          method: "POST",
          body: { idToken: account.id_token, ...(signupIntent ? { signupIntent: decodeURIComponent(signupIntent) } : {}) },
        });
        Object.assign(user, { id: result.user.id, name: result.user.name, email: result.user.email, role: result.user.role, isOnboarded: result.user.isOnboarded, accessToken: result.accessToken, refreshToken: result.refreshToken });
        return true;
      } catch (error) {
        const diagnostic = classifyGoogleExchangeFailure(error);
        console.warn(googleDiagnosticLogPayload(diagnostic));
        await writeLocalGoogleAuthDiagnostic(diagnostic);
        return false;
      }
    },
  },
}));
