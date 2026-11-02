"use server";

import { signOut } from "@/auth";
import { headers } from "next/headers";
import { revokeMarketplaceSession } from "@/lib/logout-session";

export async function signOutAction() {
  await revokeMarketplaceSession(await headers());
  await signOut({ redirectTo: "/" });
}
