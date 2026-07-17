import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { listConversationsAction } from "@/app/messages/actions";
import { ConversationsList } from "@/components/messages/conversations-list";

export default async function ClientMessagesPage() {
  const session = await auth();
  if (!session) redirect("/auth/login");

  const conversations = await listConversationsAction();

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-2xl font-semibold text-foreground sm:text-3xl">
        Messages
      </h1>
      <ConversationsList
        conversations={conversations}
        viewerUserId={session.user.id}
        basePath="/dashboard/client/messages"
      />
    </div>
  );
}
