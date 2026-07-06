import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: "freelancer" | "client" | null;
      isOnboarded: boolean;
    } & DefaultSession["user"];
  }

  interface User {
    role?: "freelancer" | "client" | null;
    isOnboarded?: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: "freelancer" | "client" | null;
    isOnboarded: boolean;
  }
}
