"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import {
  acceptConnectionAction,
  declineConnectionAction,
  sendConnectionRequestAction,
} from "@/app/connections/actions";
import { Button } from "@/components/ui/button";

export type ConnectionSummary = {
  id: string;
  status: "pending" | "accepted" | "declined";
  requesterId: string;
  receiverId: string;
  conversation: { id: string } | null;
};

type ConnectionActionPanelProps = {
  viewerUserId: string;
  profileUserId: string;
  connection: ConnectionSummary | null;
  currentPath: string;
  messagesBasePath: string;
};

export function ConnectionActionPanel({
  viewerUserId,
  profileUserId,
  connection,
  currentPath,
  messagesBasePath,
}: ConnectionActionPanelProps) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  if (viewerUserId === profileUserId) {
    return null;
  }

  async function handleConnect() {
    setPending(true);
    setError(null);
    const result = await sendConnectionRequestAction(profileUserId, currentPath);
    setPending(false);
    if (result.error) setError(result.error);
    else router.refresh();
  }

  async function handleAccept() {
    if (!connection) return;
    setPending(true);
    setError(null);
    const result = await acceptConnectionAction(connection.id, currentPath);
    setPending(false);
    if (result.error) setError(result.error);
    else router.refresh();
  }

  async function handleDecline() {
    if (!connection) return;
    setPending(true);
    setError(null);
    const result = await declineConnectionAction(connection.id, currentPath);
    setPending(false);
    if (result.error) setError(result.error);
    else router.refresh();
  }

  return (
    <div className="mt-6 flex flex-col gap-2">
      {!connection && (
        <Button onClick={handleConnect} disabled={pending} className="self-start">
          {pending ? "Sending..." : "Connect"}
        </Button>
      )}

      {connection?.status === "pending" && connection.requesterId === viewerUserId && (
        <p className="text-sm text-muted-foreground">
          Connection request sent — waiting for a response.
        </p>
      )}

      {connection?.status === "pending" && connection.receiverId === viewerUserId && (
        <div className="flex gap-2">
          <Button onClick={handleAccept} disabled={pending}>
            {pending ? "Saving..." : "Accept"}
          </Button>
          <Button variant="outline" onClick={handleDecline} disabled={pending}>
            Decline
          </Button>
        </div>
      )}

      {connection?.status === "accepted" && connection.conversation && (
        <Button
          render={<Link href={`${messagesBasePath}/${connection.conversation.id}`} />}
          nativeButton={false}
          className="self-start"
        >
          Message
        </Button>
      )}

      {connection?.status === "declined" && (
        <p className="text-sm text-muted-foreground">
          {connection.requesterId === viewerUserId
            ? "This request was declined. You can try again after the cooldown period."
            : "You declined this request."}
        </p>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
