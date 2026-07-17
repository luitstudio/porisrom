import Link from "next/link";

import type { ConversationSummary } from "@/app/messages/actions";

type ConversationsListProps = {
  conversations: ConversationSummary[];
  viewerUserId: string;
  basePath: string;
};

export function ConversationsList({
  conversations,
  viewerUserId,
  basePath,
}: ConversationsListProps) {
  if (conversations.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No conversations yet — connect with a{" "}
        {viewerUserId ? "freelancer or company" : "match"} to start chatting.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {conversations.map((conversation) => {
        const other =
          conversation.connection.requester.id === viewerUserId
            ? conversation.connection.receiver
            : conversation.connection.requester;
        const lastMessage = conversation.messages[0];

        return (
          <li key={conversation.id}>
            <Link
              href={`${basePath}/${conversation.id}`}
              className="flex flex-col gap-1 rounded-2xl border border-border bg-card p-4 transition-colors hover:border-primary/40"
            >
              <span className="font-medium text-foreground">{other.name}</span>
              <span className="line-clamp-1 text-sm text-muted-foreground">
                {lastMessage ? lastMessage.body : "No messages yet — say hello."}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
