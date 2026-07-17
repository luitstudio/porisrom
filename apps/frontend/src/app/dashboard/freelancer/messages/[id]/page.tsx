import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth";
import { getMessagesAction, listConversationsAction } from "@/app/messages/actions";
import { listWorkAssignmentsAction } from "@/app/work-assignments/actions";
import { ChatThread } from "@/components/messages/chat-thread";
import { WorkAssignmentPanel } from "@/components/work-assignments/work-assignment-panel";

export default async function FreelancerConversationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/auth/login");

  const { id } = await params;
  const [conversations, messages, assignments] = await Promise.all([
    listConversationsAction(),
    getMessagesAction(id),
    listWorkAssignmentsAction(id),
  ]);

  const conversation = conversations.find((c) => c.id === id);
  if (!conversation) notFound();

  const other =
    conversation.connection.requester.id === session.user.id
      ? conversation.connection.receiver
      : conversation.connection.requester;

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
      <WorkAssignmentPanel
        conversationId={id}
        viewerUserId={session.user.id}
        viewerRole={session.user.role}
        otherPartyName={other.name}
        initialAssignments={assignments}
      />
      <ChatThread
        conversationId={id}
        viewerUserId={session.user.id}
        otherPartyName={other.name}
        initialMessages={messages}
      />
    </div>
  );
}
