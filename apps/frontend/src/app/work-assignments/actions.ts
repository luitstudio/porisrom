"use server";

import { auth } from "@/auth";
import { BackendApiError, backendFetch } from "@/lib/backend-api";

export type WorkAssignmentEvent = {
  id: string;
  actorId: string;
  action: string;
  note: string | null;
  createdAt: string;
};

export type WorkAssignmentStatus =
  | "proposed"
  | "modification_requested"
  | "accepted"
  | "in_progress"
  | "submitted"
  | "revision_requested"
  | "delivery_accepted"
  | "payment_pending"
  | "completed"
  | "disputed"
  | "cancelled"
  | "rejected";

export type WorkAssignment = {
  id: string;
  conversationId: string;
  createdById: string;
  title: string;
  description: string;
  budgetAmount: string;
  currency: string;
  dueDate: string | null;
  status: WorkAssignmentStatus;
  cancelRequestedById: string | null;
  createdAt: string;
  updatedAt: string;
  events: WorkAssignmentEvent[];
};

export type WorkAssignmentActionResult = { error?: string; success?: boolean };

async function requireAccessToken() {
  const session = await auth();
  if (!session?.accessToken) {
    throw new Error("Not authenticated");
  }
  return session.accessToken;
}

export async function listWorkAssignmentsAction(conversationId: string): Promise<WorkAssignment[]> {
  const accessToken = await requireAccessToken();
  return backendFetch<WorkAssignment[]>(`/conversations/${conversationId}/work-assignments`, {
    accessToken,
  });
}

export type CreateWorkAssignmentInput = {
  title: string;
  description: string;
  budgetAmount: number;
  dueDate?: string;
};

export async function createWorkAssignmentAction(
  conversationId: string,
  data: CreateWorkAssignmentInput
): Promise<WorkAssignmentActionResult> {
  try {
    const accessToken = await requireAccessToken();
    await backendFetch(`/conversations/${conversationId}/work-assignments`, {
      method: "POST",
      accessToken,
      body: data,
    });
  } catch (err) {
    if (err instanceof BackendApiError) return { error: err.message };
    return { error: "Something went wrong. Please try again." };
  }
  return { success: true };
}

export async function respondWorkAssignmentAction(
  id: string,
  action: "accept" | "reject" | "request_modification",
  note?: string
): Promise<WorkAssignmentActionResult> {
  try {
    const accessToken = await requireAccessToken();
    await backendFetch(`/work-assignments/${id}/respond`, {
      method: "PATCH",
      accessToken,
      body: { action, note },
    });
  } catch (err) {
    if (err instanceof BackendApiError) return { error: err.message };
    return { error: "Something went wrong. Please try again." };
  }
  return { success: true };
}

export type ReviseWorkAssignmentInput = {
  action: "revise" | "reject";
  title?: string;
  description?: string;
  budgetAmount?: number;
  dueDate?: string;
  note?: string;
};

export async function reviseWorkAssignmentAction(
  id: string,
  data: ReviseWorkAssignmentInput
): Promise<WorkAssignmentActionResult> {
  try {
    const accessToken = await requireAccessToken();
    await backendFetch(`/work-assignments/${id}/revise`, {
      method: "PATCH",
      accessToken,
      body: data,
    });
  } catch (err) {
    if (err instanceof BackendApiError) return { error: err.message };
    return { error: "Something went wrong. Please try again." };
  }
  return { success: true };
}

export async function cancelWorkAssignmentAction(
  id: string,
  note?: string
): Promise<WorkAssignmentActionResult> {
  try {
    const accessToken = await requireAccessToken();
    await backendFetch(`/work-assignments/${id}/cancel`, {
      method: "PATCH",
      accessToken,
      body: { note },
    });
  } catch (err) {
    if (err instanceof BackendApiError) return { error: err.message };
    return { error: "Something went wrong. Please try again." };
  }
  return { success: true };
}
