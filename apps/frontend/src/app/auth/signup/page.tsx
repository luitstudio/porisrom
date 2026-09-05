import Link from "next/link";
import type { Metadata } from "next";

import { AuthScreen } from "@/components/auth/auth-screen";
import { SignupForm } from "@/components/auth/signup-form";
import { SignupRoleProvider } from "@/components/auth/signup-role-context";

export const metadata: Metadata = {
  title: "Sign up — Porisrom",
};

export default function SignupPage() {
  return (
    <SignupRoleProvider>
      <AuthScreen
        title="Create your account"
        description="Join India's fastest growing freelancer marketplace."
        footer={
          <>
            Already have an account?{" "}
            <Link href="/auth/login" className="font-medium text-primary hover:underline">
              Log in
            </Link>
          </>
        }
      >
        <SignupForm />
      </AuthScreen>
    </SignupRoleProvider>
  );
}
