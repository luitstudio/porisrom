"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";

import { AuthHeader } from "@/components/auth/auth-header";
import { SocialLoginButtons } from "@/components/auth/social-login-buttons";
import { AuthFooter } from "@/components/auth/auth-footer";
import { AuthPendingOverlay, useAuthPending } from "@/components/auth/auth-pending-state";

type MobileAuthLayoutProps = {
  title: string;
  description: string;
  footer: React.ReactNode;
  children: React.ReactNode;
};

export function MobileAuthLayout({
  title,
  description,
  footer,
  children,
}: MobileAuthLayoutProps) {
  const { isPending } = useAuthPending();
  const prefersReducedMotion = useReducedMotion();

  return (
    <div className="min-h-screen bg-white px-6 py-[max(1.5rem,env(safe-area-inset-top))]">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-md flex-col">
        <Link
          href="/"
          className="flex items-center gap-2 self-start outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <PorishromMark />
          <span className="font-display text-lg font-semibold tracking-tight text-foreground">
            Porishrom
          </span>
        </Link>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28, ease: "easeOut" }}
          className="relative flex flex-1 flex-col justify-center gap-6 overflow-hidden pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-12"
        >
          <motion.div
            animate={{ opacity: isPending ? 0.28 : 1, scale: isPending ? 0.99 : 1 }}
            transition={{ duration: prefersReducedMotion ? 0 : 0.2, ease: "easeOut" }}
            className="flex flex-col gap-6"
          >
            <AuthHeader title={title} description={description} />
            <SocialLoginButtons />
            {children}
            <AuthFooter>{footer}</AuthFooter>
          </motion.div>
          <AuthPendingOverlay />
        </motion.div>
      </div>
    </div>
  );
}

function PorishromMark() {
  return (
    <svg width="24" height="24" viewBox="0 0 26 26" fill="none" aria-hidden="true" className="shrink-0">
      <rect width="26" height="26" rx="8" className="fill-primary" />
      <path d="M13 6L19 13L13 20L7 13L13 6Z" className="fill-primary-foreground" opacity="0.95" />
      <path d="M13 10.5L15.5 13L13 15.5L10.5 13L13 10.5Z" className="fill-primary" />
    </svg>
  );
}
