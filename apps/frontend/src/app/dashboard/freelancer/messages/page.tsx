import { MessageSquare } from "lucide-react";

import { ComingSoon } from "@/components/dashboard/freelancer/coming-soon";

export default function MessagesPage() {
  return (
    <ComingSoon
      title="Messages"
      description="A full inbox for client conversations is on its way."
      icon={MessageSquare}
    />
  );
}
