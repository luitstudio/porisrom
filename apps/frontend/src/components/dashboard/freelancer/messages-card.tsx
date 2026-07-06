import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RECENT_MESSAGES } from "@/lib/freelancer-dashboard-data";

export function MessagesCard() {
  return (
    <Card className="border-border shadow-[0_1px_2px_rgba(20,21,43,0.04)]">
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="font-display text-lg">Messages</CardTitle>
        <Link
          href="/dashboard/freelancer/messages"
          className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
        >
          View all
          <ArrowRight className="size-3.5" />
        </Link>
      </CardHeader>
      <CardContent>
        <ul className="flex flex-col gap-1">
          {RECENT_MESSAGES.map((message) => (
            <li key={message.name}>
              <Link
                href="/dashboard/freelancer/messages"
                className="flex items-center gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-secondary"
              >
                <Avatar className="size-10 border border-border">
                  <AvatarFallback className="bg-accent text-sm font-semibold text-foreground">
                    {message.initials}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 overflow-hidden">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-semibold text-foreground">
                      {message.name}
                    </p>
                    <span className="shrink-0 text-[11px] text-muted-foreground">
                      {message.time}
                    </span>
                  </div>
                  <p className="truncate text-xs text-muted-foreground">{message.snippet}</p>
                </div>
                {message.unread && <span className="size-2 shrink-0 rounded-full bg-primary" />}
              </Link>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
