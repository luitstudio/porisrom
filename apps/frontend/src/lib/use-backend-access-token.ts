"use client";

import { useSession } from "next-auth/react";

// Keep existing socket surfaces on the current shared browser session after
// rotation. An explicitly failed session must not fall back to an old prop token.
export function useBackendAccessToken(initialToken: string) {
  const { data: session, status } = useSession();
  if (status === "unauthenticated" || session?.error) return undefined;
  return session?.accessToken ?? initialToken;
}
