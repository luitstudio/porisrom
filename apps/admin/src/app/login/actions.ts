"use server";

import { redirect } from "next/navigation";

import { BackendApiError } from "@/lib/backend-api";
import { loginAdmin } from "@/lib/session";

export type LoginState = { error?: string };

export async function login(_prevState: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Email and password are required" };
  }

  try {
    await loginAdmin(email, password);
  } catch (err) {
    if (err instanceof BackendApiError) {
      return { error: err.message };
    }
    return { error: "Login failed" };
  }

  redirect("/");
}
