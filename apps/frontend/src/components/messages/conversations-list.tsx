import Link from "next/link";

import type { ConversationSummary } from "@/app/messages/actions";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";

type ConversationsListProps = { conversations: ConversationSummary[]; viewerUserId: string; basePath: string; clientPresentation?: boolean };

export function ConversationsList({ conversations, viewerUserId, basePath, clientPresentation = false }: ConversationsListProps) {
  if (conversations.length === 0) return clientPresentation ? <div className="flex min-h-28 items-center rounded-xl border border-[#2B2E34] bg-[#181A1F] px-3.5 text-sm text-[#A0A5AF]">No conversations yet — connect with a freelancer to start chatting.</div> : <p className="text-sm text-muted-foreground">No conversations yet — connect with a {viewerUserId ? "freelancer or company" : "match"} to start chatting.</p>;
  return <ul className={clientPresentation ? "flex flex-col gap-2" : "flex flex-col gap-3"}>{conversations.map((conversation) => {
    const other = conversation.connection.requester.id === viewerUserId ? conversation.connection.receiver : conversation.connection.requester;
    const lastMessage = conversation.messages[0];
    const initials = other.name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
    const timestamp = lastMessage?.createdAt ?? conversation.createdAt;
    return <li key={conversation.id}><Card className={clientPresentation ? "overflow-visible border-[#2B2E34] bg-[#181A1F] py-0 shadow-none transition-colors hover:border-[#F07E6A]/60 hover:bg-[#1C1F24]" : "overflow-visible py-0 transition-[border-color,box-shadow] hover:border-primary/30 hover:shadow-md"}><CardContent className="p-0"><Link href={`${basePath}/${conversation.id}`} className="flex min-h-[4.5rem] items-center gap-3 px-3.5 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:px-4"><Avatar className="size-9"><AvatarFallback>{initials}</AvatarFallback></Avatar><span className="min-w-0 flex-1"><span className={clientPresentation ? "block truncate text-body font-semibold text-[#F5F5F5]" : "block truncate text-body font-semibold text-foreground"}>{other.name}</span><span className={clientPresentation ? "block line-clamp-1 text-metadata text-[#A0A5AF]" : "block line-clamp-1 text-muted-body text-muted-foreground"}>{lastMessage ? lastMessage.body : "No messages yet — say hello."}</span></span>{clientPresentation && <time dateTime={timestamp} className="shrink-0 self-start pt-0.5 text-metadata text-[#737984]">{new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short" }).format(new Date(timestamp))}</time>}</Link></CardContent></Card></li>;
  })}</ul>;
}
