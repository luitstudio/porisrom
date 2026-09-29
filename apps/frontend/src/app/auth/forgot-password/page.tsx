import Link from "next/link";
import type { Metadata } from "next";

import { AuthScreen } from "@/components/auth/auth-screen";
import { Button } from "@/components/ui/button";

const SUPPORT_EMAIL = "support@porisrom.com";

export const metadata: Metadata = {
  title: "Account recovery — Porisrom",
};

export default function ForgotPasswordPage() {
  return (
    <AuthScreen
      title="Recover your account"
      description="For the V1 pilot, account recovery is handled by the Porisrom support team after identity verification. Support will not confirm whether an account exists until verification is complete."
      footer={
        <>
          Remembered it after all?{" "}
          <Link href="/auth/login" className="font-medium text-primary hover:underline">
            Log in
          </Link>
        </>
      }
    >
      <Button render={<a href={`mailto:${SUPPORT_EMAIL}?subject=Account%20recovery`} />} nativeButton={false} size="lg" className="h-13 w-full justify-center rounded-full text-base">
        Contact verified support
      </Button>
    </AuthScreen>
  );
}
