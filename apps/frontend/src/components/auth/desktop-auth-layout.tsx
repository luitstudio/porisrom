"use client";

import { useRouter } from "next/navigation";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { motion, useReducedMotion } from "framer-motion";
import { XIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogPortal, DialogOverlay } from "@/components/ui/dialog";
import { AuthBrandPanel } from "@/components/auth/auth-brand-panel";
import { AuthHeader } from "@/components/auth/auth-header";
import { SocialLoginButtons } from "@/components/auth/social-login-buttons";
import { AuthFooter } from "@/components/auth/auth-footer";
import { AuthPendingOverlay, useAuthPending } from "@/components/auth/auth-pending-state";

type DesktopAuthLayoutProps = {
  title: string;
  description: string;
  footer: React.ReactNode;
  children: React.ReactNode;
};

export function DesktopAuthLayout({
  title,
  description,
  footer,
  children,
}: DesktopAuthLayoutProps) {
  const router = useRouter();
  const prefersReducedMotion = useReducedMotion();
  const { isPending } = useAuthPending();

  return (
    <Dialog
      defaultOpen
      onOpenChange={(open) => {
        if (!open) router.push("/");
      }}
    >
      <DialogPortal>
        <DialogOverlay className="bg-black/45 backdrop-blur-md" />
        <DialogPrimitive.Popup
          data-slot="dialog-content"
          className="fixed top-1/2 left-1/2 z-50 -translate-x-1/2 -translate-y-1/2 outline-none"
        >
          <motion.div
            initial={
              prefersReducedMotion ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.98 }
            }
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: prefersReducedMotion ? 0 : 0.25, ease: "easeOut" }}
            className="relative grid h-[min(720px,90vh)] w-[min(1100px,92vw)] overflow-hidden rounded-[28px] bg-white text-card-foreground shadow-[0_34px_90px_-28px_rgba(20,21,43,0.55)] md:grid-cols-[48%_52%]"
          >
            <div className="hidden md:block">
              <AuthBrandPanel />
            </div>

            <div className="relative flex h-full flex-col overflow-y-auto bg-white px-8 py-10 sm:px-12 lg:px-16">
              <motion.div
                animate={{ opacity: isPending ? 0.28 : 1, scale: isPending ? 0.99 : 1 }}
                transition={{ duration: prefersReducedMotion ? 0 : 0.2, ease: "easeOut" }}
                className="mx-auto flex w-full max-w-[410px] flex-1 flex-col justify-center gap-6"
              >
                <AuthHeader title={title} description={description} />
                <SocialLoginButtons />
                {children}
                <AuthFooter>{footer}</AuthFooter>
              </motion.div>
              <AuthPendingOverlay />
            </div>

            <DialogPrimitive.Close
              data-slot="dialog-close"
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Close and return to homepage"
                  className="absolute top-5 right-5 size-9 rounded-full border border-border/70 bg-white/85 text-foreground/70 shadow-sm hover:bg-white hover:text-foreground"
                />
              }
            >
              <XIcon className="size-4" />
            </DialogPrimitive.Close>
          </motion.div>
        </DialogPrimitive.Popup>
      </DialogPortal>
    </Dialog>
  );
}
