import Link from "next/link";
import type { Metadata } from "next";

import { AuthScreen } from "@/components/auth/auth-screen";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = {
  title: "Log in — Porisrom",
};

export default function LoginPage() {
  return (
    <AuthScreen
      title="Welcome back"
      description="Log in to continue with Porishrom."
      footer={
        <>
          Don&apos;t have an account?{" "}
          <Link href="/auth/signup" className="font-medium text-primary hover:underline">
            Sign up
          </Link>
        </>
      }
    >
      <LoginForm />
    </AuthScreen>
  );
}
