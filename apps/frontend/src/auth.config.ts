import type { NextAuthConfig } from "next-auth";

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
        token.role = user.role as "freelancer" | "client" | null;
        token.isOnboarded = user.isOnboarded as boolean;
      }
      if (trigger === "update" && session) {
        const update = session as Partial<{
          role: "freelancer" | "client" | null;
          isOnboarded: boolean;
        }>;
        if (update.role !== undefined) token.role = update.role;
        if (update.isOnboarded !== undefined) token.isOnboarded = update.isOnboarded;
      }
      return token;
    },
    async session({ session, token }) {
      session.user.id = token.id as string;
      session.user.role = token.role as "freelancer" | "client" | null;
      session.user.isOnboarded = token.isOnboarded as boolean;
      return session;
    },
  },
};
