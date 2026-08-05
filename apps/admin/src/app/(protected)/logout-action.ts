"use server";

import { redirect } from "next/navigation";

import { logoutAdmin } from "@/lib/session";

export async function logout() {
  await logoutAdmin();
  redirect("/login");
}
