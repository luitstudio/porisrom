"use client";

import * as React from "react";

import { getMessagesAction, sendMessageAction, type MessageItem } from "@/app/messages/actions";
import { Button } from "@/components/ui/button";

const POLL_INTERVAL_MS = 4000;

type ChatThreadProps = {
  conversationId: string;
  viewerUserId: string;
  otherPartyName: string;
  initialMessages: MessageItem[];
};

export function ChatThread({
  conversationId,
  viewerUserId,
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
      setMessages((prev) => [...prev, sent]);
      setDraft("");
    } catch {
      setError("Message failed to send. Please try again.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex h-[70vh] flex-col rounded-2xl border border-border bg-card">
      <div className="border-b border-border px-5 py-4">
        <h1 className="font-semibold text-foreground">{otherPartyName}</h1>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
        {messages.length === 0 && (
          <p className="text-sm text-muted-foreground">No messages yet — say hello.</p>
        )}
        {messages.map((message) => {
          const isMine = message.senderId === viewerUserId;
          return (
            <div key={message.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm ${
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
      </div>

      <form onSubmit={handleSend} className="flex items-center gap-2 border-t border-border p-4">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Type a message..."
          disabled={sending}
          className="h-11 flex-1 rounded-lg border border-input bg-transparent px-3 text-sm text-foreground"
        />
        <Button type="submit" disabled={sending || !draft.trim()}>
          Send
        </Button>
      </form>
      {error && <p className="px-5 pb-3 text-xs text-destructive">{error}</p>}
    </div>
  );
}
