"use client";

import * as React from "react";
import { io } from "socket.io-client";

import { getMessagesAction, sendMessageAction, type MessageItem } from "@/app/messages/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { upsertMessageById } from "@/lib/realtime-message.mjs";
import { getPublicBackendUrl } from "@/lib/public-backend-url";

const POLL_INTERVAL_MS = 4000;

type ChatThreadProps = {
  conversationId: string;
  viewerUserId: string;
  accessToken: string;
  otherPartyName: string;
  initialMessages: MessageItem[];
};

export function ChatThread({
  conversationId,
  viewerUserId,
  accessToken,
  otherPartyName,
  initialMessages,
}: ChatThreadProps) {
  const [messages, setMessages] = React.useState<MessageItem[]>(initialMessages);
  const [draft, setDraft] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const bottomRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const fresh = await getMessagesAction(conversationId);
        setMessages(fresh);
      } catch {
        // transient poll failure — try again next tick
      }
    }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [conversationId]);

  React.useEffect(() => {
    const socket = io(getPublicBackendUrl(), {
      auth: { token: accessToken },
      transports: ["websocket", "polling"],
    });

    const onMessageCreated = (message: MessageItem) => {
      if (message.conversationId !== conversationId) return;
      setMessages((previous) => upsertMessageById(previous, message));
    };

    socket.on("message.created", onMessageCreated);
    return () => {
      socket.off("message.created", onMessageCreated);
      socket.disconnect();
    };
  }, [accessToken, conversationId]);

  React.useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const body = draft.trim();
    if (!body) return;

    setSending(true);
    setError(null);
    try {
      const sent = await sendMessageAction(conversationId, body);
      setMessages((prev) => upsertMessageById(prev, sent));
      setDraft("");
    } catch {
      setError("Message failed to send. Please try again.");
    } finally {
      setSending(false);
    }
  }

  return (
    <Card className="flex h-[70vh] min-h-100 flex-col gap-0 overflow-hidden py-0 shadow-[var(--shadow-subtle)]">
      <CardHeader className="border-b border-border px-4 py-3 sm:px-5 sm:py-4">
        <CardTitle>{otherPartyName}</CardTitle>
      </CardHeader>

      <CardContent className="flex-1 space-y-3 overflow-y-auto px-4 py-4 sm:px-5">
        {messages.length === 0 && (
          <p className="text-sm text-muted-foreground">No messages yet — say hello.</p>
        )}
        {messages.map((message) => {
          const isMine = message.senderId === viewerUserId;
          return (
            <div key={message.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[80%] rounded-[var(--radius-control)] px-3 py-2 text-body sm:max-w-[75%] ${
                  isMine
                    ? "bg-primary text-primary-foreground"
                    : "bg-accent text-accent-foreground"
                }`}
              >
                {message.body}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </CardContent>

      <CardFooter className="border-t border-border bg-card p-3 sm:p-4">
        <form onSubmit={handleSend} className="flex w-full items-center gap-2">
        <Input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Type a message..."
          disabled={sending}
          className="h-10 flex-1"
        />
        <Button type="submit" disabled={sending || !draft.trim()}>
          Send
        </Button>
        </form>
      </CardFooter>
      {error && <p className="px-4 pb-3 text-metadata text-destructive sm:px-5">{error}</p>}
    </Card>
  );
}
