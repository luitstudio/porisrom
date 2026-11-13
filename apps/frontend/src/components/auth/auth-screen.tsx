"use client";

import * as React from "react";

import { DecorativeHomepageBackdrop } from "@/components/auth/decorative-homepage-backdrop";
import { DesktopAuthLayout } from "@/components/auth/desktop-auth-layout";
import { MobileAuthLayout } from "@/components/auth/mobile-auth-layout";
import { AuthPendingProvider } from "@/components/auth/auth-pending-state";

const DESKTOP_QUERY = "(min-width: 640px)";

function subscribe(onChange: () => void) {
  const mediaQuery = window.matchMedia(DESKTOP_QUERY);
  mediaQuery.addEventListener("change", onChange);
  return () => mediaQuery.removeEventListener("change", onChange);
}

function useIsDesktop() {
  return React.useSyncExternalStore(
    subscribe,
    () => window.matchMedia(DESKTOP_QUERY).matches,
    () => false
  );
}

type AuthScreenProps = {
  title: string;
  description: string;
  footer: React.ReactNode;
  children: React.ReactNode;
  showSocial?: boolean;
};

export function AuthScreen({ title, description, footer, children, showSocial = true }: AuthScreenProps) {
  const isDesktop = useIsDesktop();

  if (isDesktop) {
    return (
      <AuthPendingProvider>
        <DecorativeHomepageBackdrop />
        <DesktopAuthLayout title={title} description={description} footer={footer} showSocial={showSocial}>
          {children}
        </DesktopAuthLayout>
      </AuthPendingProvider>
    );
  }

  return (
    <AuthPendingProvider>
      <MobileAuthLayout title={title} description={description} footer={footer} showSocial={showSocial}>
        {children}
      </MobileAuthLayout>
    </AuthPendingProvider>
  );
}
