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

export type DeliverableType =
  | "demo"
  | "preview"
  | "watermarked_file"
  | "drive_link"
  | "github_link"
  | "file";

export type Deliverable = {
  id: string;
  workAssignmentId: string;
  type: DeliverableType;
  url: string;
  note: string | null;
  submittedAt: string;
};

export type PaymentVerificationStatus =
  | "awaiting_client"
  | "awaiting_freelancer"
  | "mismatch"
  | "verified";

export type PaymentVerification = {
  id: string;
  workAssignmentId: string;
  clientUtr: string | null;
  clientClaimedAt: string | null;
  freelancerUtr: string | null;
  freelancerClaimedAt: string | null;
  mismatchCount: number;
  status: PaymentVerificationStatus;
  verifiedAt: string | null;
};

export type ReviewDirection = "client_to_freelancer" | "freelancer_to_client";

export type Review = {
  id: string;
  workAssignmentId: string;
  authorId: string;
  targetId: string;
  direction: ReviewDirection;
  rating: number;
  comment: string | null;
  createdAt: string;
};

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
  deliverables: Deliverable[];
  paymentVerification: PaymentVerification | null;
  reviews: Review[];
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

export type SubmitDeliverableInput = {
  type: DeliverableType;
  url: string;
  note?: string;
};

export async function submitDeliverableAction(
  id: string,
  data: SubmitDeliverableInput
): Promise<WorkAssignmentActionResult> {
  try {
    const accessToken = await requireAccessToken();
    await backendFetch(`/work-assignments/${id}/deliverables`, {
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

export async function acceptDeliveryAction(id: string): Promise<WorkAssignmentActionResult> {
  try {
    const accessToken = await requireAccessToken();
    await backendFetch(`/work-assignments/${id}/delivery/accept`, {
      method: "PATCH",
      accessToken,
    });
  } catch (err) {
    if (err instanceof BackendApiError) return { error: err.message };
    return { error: "Something went wrong. Please try again." };
  }
  return { success: true };
}

export async function requestDeliveryRevisionAction(
  id: string,
  note?: string
): Promise<WorkAssignmentActionResult> {
  try {
    const accessToken = await requireAccessToken();
    await backendFetch(`/work-assignments/${id}/delivery/request-revision`, {
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

export async function claimPaidAction(
  id: string,
  utr: string
): Promise<WorkAssignmentActionResult> {
  try {
    const accessToken = await requireAccessToken();
    await backendFetch(`/work-assignments/${id}/payment/claim-paid`, {
      method: "POST",
      accessToken,
      body: { utr },
    });
  } catch (err) {
    if (err instanceof BackendApiError) return { error: err.message };
    return { error: "Something went wrong. Please try again." };
  }
  return { success: true };
}

export async function claimReceivedAction(
  id: string,
  utr: string
): Promise<WorkAssignmentActionResult> {
  try {
    const accessToken = await requireAccessToken();
    await backendFetch(`/work-assignments/${id}/payment/claim-received`, {
      method: "POST",
      accessToken,
      body: { utr },
    });
  } catch (err) {
    if (err instanceof BackendApiError) return { error: err.message };
    return { error: "Something went wrong. Please try again." };
  }
  return { success: true };
}

export async function createReviewAction(
  id: string,
  rating: number,
  comment?: string
): Promise<WorkAssignmentActionResult> {
  try {
    const accessToken = await requireAccessToken();
    await backendFetch(`/work-assignments/${id}/reviews`, {
      method: "POST",
      accessToken,
      body: { rating, comment },
    });
  } catch (err) {
    if (err instanceof BackendApiError) return { error: err.message };
    return { error: "Something went wrong. Please try again." };
  }
  return { success: true };
}
