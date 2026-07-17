"use server";

import { auth } from "@/auth";
import { backendFetch } from "@/lib/backend-api";

export type ConversationSummary = {
  id: string;
  createdAt: string;
  connection: {
    id: string;
    requester: { id: string; name: string };
    receiver: { id: string; name: string };
  };
  messages: { id: string; body: string; senderId: string; createdAt: string }[];
};

export type MessageItem = {
  id: string;
  conversationId: string;
  senderId: string;
  body: string;
  createdAt: string;
  readAt: string | null;
};

async function requireAccessToken() {
  const session = await auth();
  if (!session?.accessToken) {
    throw new Error("Not authenticated");
  }
  return session.accessToken;
}

export async function listConversationsAction(): Promise<ConversationSummary[]> {
  const accessToken = await requireAccessToken();
  return backendFetch<ConversationSummary[]>("/conversations", { accessToken });
}

export async function getMessagesAction(conversationId: string): Promise<MessageItem[]> {
  const accessToken = await requireAccessToken();
  return backendFetch<MessageItem[]>(`/conversations/${conversationId}/messages`, { accessToken });
}

export async function sendMessageAction(
  conversationId: string,
  body: string
): Promise<MessageItem> {
  const accessToken = await requireAccessToken();
  return backendFetch<MessageItem>(`/conversations/${conversationId}/messages`, {
    method: "POST",
    accessToken,
    body: { body },
  });
}
