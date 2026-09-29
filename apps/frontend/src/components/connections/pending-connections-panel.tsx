"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowUpRight, Check, Clock, UserRound, X } from "lucide-react";

import {
  acceptConnectionAction,
  declineConnectionAction,
  type ConnectionRecord,
} from "@/app/connections/actions";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type PendingConnectionsPanelProps = {
  initialConnections: ConnectionRecord[];
  viewerUserId: string;
  messagesBasePath: string;
  currentPath: string;
  loadFailed?: boolean;
  clientPresentation?: boolean;
};

export function PendingConnectionsPanel({
  initialConnections,
  viewerUserId,
  messagesBasePath,
  currentPath,
  loadFailed = false,
  clientPresentation = false,
}: PendingConnectionsPanelProps) {
  const [connections, setConnections] = React.useState(initialConnections);
  const [pendingId, setPendingId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [accepted, setAccepted] = React.useState<ConnectionRecord | null>(null);

  const pendingConnections = connections.filter(({ status }) => status === "pending");
  const incoming = pendingConnections.filter(({ receiverId }) => receiverId === viewerUserId);
  const outgoing = pendingConnections.filter(({ requesterId }) => requesterId === viewerUserId);

  async function accept(connection: ConnectionRecord) {
    if (pendingId) return;
    setPendingId(connection.id);
    setError(null);
    const result = await acceptConnectionAction(connection.id, currentPath);
    if (result.connection) {
      setConnections((current) => current.filter(({ id }) => id !== connection.id));
      setAccepted(result.connection);
    } else {
      setError(result.error ?? "We couldn't accept this request.");
    }
    setPendingId(null);
  }

  async function decline(connection: ConnectionRecord) {
    if (pendingId) return;
    setPendingId(connection.id);
    setError(null);
    const result = await declineConnectionAction(connection.id, currentPath);
    if (result.success) {
      setConnections((current) => current.filter(({ id }) => id !== connection.id));
      setAccepted(null);
    } else {
      setError(result.error ?? "We couldn't decline this request.");
    }
    setPendingId(null);
  }

  const requestGroups = <><ConnectionGroup title="Incoming" empty="No incoming requests.">{incoming.map((connection) => <li key={connection.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border p-3"><Identity name={connection.requester.name} role={connection.requester.role} /><div className="flex gap-2"><Button size="sm" className={clientPresentation ? "bg-[#F07E6A] text-[#0A0C0E] hover:bg-[#FF8C78]" : undefined} disabled={pendingId !== null} onClick={() => void accept(connection)}><Check className="size-4" /> {pendingId === connection.id ? "Saving..." : "Accept"}</Button><Button size="sm" variant="outline" className={clientPresentation ? "border-[#2B2E34] bg-[#1C1F24] text-[#A0A5AF] hover:bg-[#2B2E34] hover:text-[#F5F5F5]" : undefined} disabled={pendingId !== null} onClick={() => void decline(connection)}><X className="size-4" /> Decline</Button></div></li>)}</ConnectionGroup><ConnectionGroup title="Outgoing" empty="No outgoing requests.">{outgoing.map((connection) => <li key={connection.id} className="flex items-center justify-between gap-3 rounded-xl border border-border p-3"><Identity name={connection.receiver.name} role={connection.receiver.role} /><Badge variant="secondary"><Clock className="size-3.5" /> Pending</Badge></li>)}</ConnectionGroup></>;

  void requestGroups;
  return (
    <Card className={clientPresentation ? "border-[#2B2E34] bg-[#181A1F] shadow-none" : "border-border shadow-[0_1px_2px_rgba(20,21,43,0.04)]"}>
      <CardHeader className={clientPresentation ? "px-3.5 py-3" : undefined}>
        <CardTitle className={clientPresentation ? "font-display text-lg text-[#F5F5F5]" : "font-display text-lg"}>Connection requests</CardTitle>
        {clientPresentation && <p className="mt-1 text-metadata text-[#737984]">People who want to work with you.</p>}
      </CardHeader>
      <CardContent className={clientPresentation ? "space-y-4 px-3.5 pb-3.5" : "space-y-5"}>
        {loadFailed ? (
          <p className="text-sm text-destructive">
            We couldn&apos;t load connection requests. Please refresh and try again.
          </p>
        ) : (
          <>
            {accepted?.conversation && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-primary/10 p-3 text-sm">
                <span>Connection accepted. You can start messaging now.</span>
                <Button
                  render={<Link href={`${messagesBasePath}/${accepted.conversation.id}`} />}
                  nativeButton={false}
                  size="sm"
                >
                  Open conversation <ArrowUpRight className="size-4" />
                </Button>
              </div>
            )}

            {clientPresentation ? <Tabs defaultValue="incoming" className="gap-3"><TabsList className="w-full bg-[#1C1F24] p-1 [&_[data-slot=tabs-trigger]]:h-9 [&_[data-slot=tabs-trigger][data-active]]:bg-[#4A2F2F] [&_[data-slot=tabs-trigger][data-active]]:text-[#F5F5F5]"><TabsTrigger value="incoming">Incoming</TabsTrigger><TabsTrigger value="outgoing">Outgoing</TabsTrigger></TabsList><TabsContent value="incoming"><ConnectionGroup title="Incoming" empty="No incoming requests.">{incoming.map((connection) => <li key={connection.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#2B2E34] p-3"><Identity name={connection.requester.name} role={connection.requester.role} /><div className="flex gap-2"><Button size="sm" className="bg-[#F07E6A] text-[#0A0C0E] hover:bg-[#FF8C78]" disabled={pendingId !== null} onClick={() => void accept(connection)}><Check className="size-4" /> {pendingId === connection.id ? "Saving..." : "Accept"}</Button><Button size="sm" variant="outline" className="border-[#2B2E34] bg-[#1C1F24] text-[#A0A5AF]" disabled={pendingId !== null} onClick={() => void decline(connection)}><X className="size-4" /> Decline</Button></div></li>)}</ConnectionGroup></TabsContent><TabsContent value="outgoing"><ConnectionGroup title="Outgoing" empty="No outgoing requests.">{outgoing.map((connection) => <li key={connection.id} className="flex items-center justify-between gap-3 rounded-lg border border-[#2B2E34] p-3"><Identity name={connection.receiver.name} role={connection.receiver.role} /><Badge variant="secondary"><Clock className="size-3.5" /> Pending</Badge></li>)}</ConnectionGroup></TabsContent></Tabs> : <><ConnectionGroup title="Incoming" empty="No incoming requests.">
              {incoming.map((connection) => (
                <li key={connection.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border p-3">
                  <Identity name={connection.requester.name} role={connection.requester.role} />
                  <div className="flex gap-2">
                    <Button size="sm" className={clientPresentation ? "bg-[#F07E6A] text-[#0A0C0E] hover:bg-[#FF8C78]" : undefined} disabled={pendingId !== null} onClick={() => void accept(connection)}>
                      <Check className="size-4" /> {pendingId === connection.id ? "Saving..." : "Accept"}
                    </Button>
                    <Button size="sm" variant="outline" className={clientPresentation ? "border-[#2B2E34] bg-[#1C1F24] text-[#A0A5AF] hover:bg-[#2B2E34] hover:text-[#F5F5F5]" : undefined} disabled={pendingId !== null} onClick={() => void decline(connection)}>
                      <X className="size-4" /> Decline
                    </Button>
                  </div>
                </li>
              ))}
            </ConnectionGroup>

            <ConnectionGroup title="Outgoing" empty="No outgoing requests.">
              {outgoing.map((connection) => (
                <li key={connection.id} className="flex items-center justify-between gap-3 rounded-xl border border-border p-3">
                  <Identity name={connection.receiver.name} role={connection.receiver.role} />
                  <Badge variant="secondary"><Clock className="size-3.5" /> Pending</Badge>
                </li>
              ))}
            </ConnectionGroup></>}
          </>
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}
      </CardContent>
    </Card>
  );
}

function ConnectionGroup({ title, empty, children }: { title: string; empty: string; children: React.ReactNode }) {
  const hasItems = React.Children.count(children) > 0;
  return (
    <section>
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      {hasItems ? <ul className="mt-2 space-y-2">{children}</ul> : <p className="mt-2 text-sm text-muted-foreground">{empty}</p>}
    </section>
  );
}

function Identity({ name, role }: { name: string; role: "client" | "freelancer" }) {
  return (
    <div className="flex items-center gap-3">
      <Avatar className="size-9">
        <AvatarFallback><UserRound className="size-4" /></AvatarFallback>
      </Avatar>
      <div>
        <p className="text-sm font-medium text-foreground">{name}</p>
        <p className="text-xs capitalize text-muted-foreground">{role}</p>
      </div>
    </div>
  );
}
