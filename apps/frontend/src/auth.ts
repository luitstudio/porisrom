import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";

import { authConfig } from "@/auth.config";
import { backendFetch } from "@/lib/backend-api";

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

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
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
            role: result.user.role === "admin" ? null : result.user.role,
            isOnboarded: result.user.isOnboarded,
            accessToken: result.accessToken,
            refreshToken: result.refreshToken,
          };
        } catch (err) {
          console.error("Backend login failed during authorize():", err);
          return null;
        }
      },
    }),
  ],
});
