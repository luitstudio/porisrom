"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import type { OnboardingRole } from "@/lib/onboarding-types";

function dashboardPathFor(role: OnboardingRole) {
  return role === "freelancer" ? "/dashboard/freelancer" : "/dashboard/client";
}

export async function setRoleAction(
  role: OnboardingRole
): Promise<{ ok: true } | { error: string }> {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: "You need to be logged in to continue." };
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { role },
  });

  return { ok: true };
}

type CompletionChecks = Record<string, boolean>;

export async function completeOnboardingAction(
  role: OnboardingRole,
  checks: CompletionChecks
): Promise<{ redirectTo: string } | { error: string }> {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: "You need to be logged in to continue." };
  }

  const total = Object.keys(checks).length;
  const filled = Object.values(checks).filter(Boolean).length;
  const profileCompleteness = total > 0 ? Math.round((filled / total) * 100) : 100;

  await prisma.user.update({
    where: { id: session.user.id },
    data: { role, isOnboarded: true, profileCompleteness },
  });

  return { redirectTo: dashboardPathFor(role) };
}
