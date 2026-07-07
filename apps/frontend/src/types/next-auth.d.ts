import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: "freelancer" | "client" | null;
      isOnboarded: boolean;
    } & DefaultSession["user"];
    accessToken: string;
    error?: "RefreshFailed";
  }

  interface User {
    role?: "freelancer" | "client" | null;
    isOnboarded?: boolean;
    accessToken?: string;
    refreshToken?: string;
    accessTokenExpires?: number;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: "freelancer" | "client" | null;
    isOnboarded: boolean;
    accessToken: string;
    refreshToken: string;
    accessTokenExpires: number;
    error?: "RefreshFailed";
  }
}
