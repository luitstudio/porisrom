"use server";

import { auth } from "@/auth";
import { backendFetch } from "@/lib/backend-api";

export type AdminPaymentRecord = {
  id: string;
  clientUtr: string | null;
  freelancerUtr: string | null;
  mismatchCount: number;
  status: "awaiting_client" | "awaiting_freelancer" | "mismatch" | "verified";
  verifiedAt: string | null;
  workAssignment: {
    id: string;
    title: string;
    status: string;
    budgetAmount: string;
    currency: string;
    conversation: {
      connection: {
        requester: { id: string; name: string };
        receiver: { id: string; name: string };
      };
    };
  };
};

export async function listAdminPaymentsAction(): Promise<AdminPaymentRecord[]> {
  const session = await auth();
  if (!session?.accessToken) {
    throw new Error("Not authenticated");
  }
  return backendFetch<AdminPaymentRecord[]>("/admin/payments", { accessToken: session.accessToken });
}
