import Link from "next/link";
import type { Metadata } from "next";

import { AuthScreen } from "@/components/auth/auth-screen";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Reset password — Porisrom",
};

export default function ForgotPasswordPage() {
  return (
    <AuthScreen
      title="Reset your password"
      description="Password reset is coming soon. In the meantime, log in with your existing password."
      footer={
        <>
          Remembered it after all?{" "}
          <Link href="/auth/login" className="font-medium text-primary hover:underline">
            Log in
          </Link>
        </>
      }
    >
      <Button render={<Link href="/auth/login" />} nativeButton={false} size="lg" className="h-13 w-full justify-center rounded-full text-base">
        Back to login
      </Button>
    </AuthScreen>
  );
}
