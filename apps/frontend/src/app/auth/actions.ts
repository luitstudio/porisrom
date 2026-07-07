"use server";

import { redirect } from "next/navigation";
import { AuthError } from "next-auth";
import { z } from "zod";

import { signIn } from "@/auth";
import { BackendApiError, backendFetch } from "@/lib/backend-api";

export type AuthActionState = {
  error?: string;
};

const signupSchema = z.object({
  name: z.string().trim().min(2, "Enter your full name."),
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
  password: z.string().min(8, "Password must be at least 8 characters."),
  role: z.enum(["freelancer", "client"], { message: "Choose an account type." }),
});

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
  password: z.string().min(1, "Enter your password."),
});

function dashboardPathFor(role: "freelancer" | "client" | null) {
  return role === "freelancer" ? "/dashboard/freelancer" : "/dashboard/client";
}

export async function signupAction(
  _prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const parsed = signupSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    role: formData.get("role"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const { name, email, password, role } = parsed.data;

  try {
    await backendFetch("/auth/signup", {
      method: "POST",
      body: { name, email, password, role },
    });
  } catch (error) {
    if (error instanceof BackendApiError) {
      return {
        error:
          error.status === 409
            ? "An account with this email already exists."
            : error.message,
      };
    }
    return { error: "Something went wrong. Please try again." };
  }

  try {
    await signIn("credentials", { email, password, redirect: false });
  } catch {
    return { error: "Account created, but sign-in failed. Please log in." };
  }

  redirect("/onboarding");
}

export async function loginAction(
  _prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const { email, password } = parsed.data;

  let target: string;
  try {
    const result = await backendFetch<{
      user: { role: "freelancer" | "client" | "admin" | null; isOnboarded: boolean };
    }>("/auth/login", { method: "POST", body: { email, password } });
    target = result.user.isOnboarded
      ? dashboardPathFor(result.user.role === "admin" ? null : result.user.role)
      : "/onboarding";
  } catch (error) {
    if (error instanceof BackendApiError && error.status === 401) {
      return { error: "Invalid email or password." };
    }
    return { error: "Something went wrong. Please try again." };
  }

  try {
    await signIn("credentials", { email, password, redirect: false });
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "Invalid email or password." };
    }
    throw error;
  }

  redirect(target);
}
