"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { auth, signIn } from "@/auth";
import { backendFetch } from "@/lib/backend-api";
import {
  backendSessionBinding,
  createGoogleLinkIntent,
  GOOGLE_LINK_INTENT_COOKIE,
  GOOGLE_LINK_INTENT_MAX_AGE_SECONDS,
  type GoogleLinkReturnPath,
} from "@/lib/google-link-intent";

export async function startGoogleLinkAction() {
  const session = await auth();
  const returnPath: GoogleLinkReturnPath = session?.user.role === "client"
    ? "/dashboard/client/settings"
    : "/dashboard/freelancer/settings";
  const binding = backendSessionBinding(session?.accessToken);
  if (!session?.user.id || !binding || binding.userId !== session.user.id) {
    redirect(`${returnPath}?googleLink=unavailable`);
  }

  let nonce: string;
  try {
    ({ nonce } = await backendFetch<{ nonce: string }>("/auth/google/link-intent", {
      method: "POST",
      accessToken: session.accessToken,
      body: {},
    }));
  } catch {
    redirect(`${returnPath}?googleLink=unavailable`);
  }
  const cookieStore = await cookies();
  cookieStore.set(GOOGLE_LINK_INTENT_COOKIE, createGoogleLinkIntent({
    userId: binding.userId,
    sessionId: binding.sessionId,
    returnPath,
    nonce,
  }), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: GOOGLE_LINK_INTENT_MAX_AGE_SECONDS,
    path: "/",
  });
  await signIn("google", { redirectTo: returnPath });
}
