import { Wallet } from "lucide-react";

import { ComingSoon } from "@/components/dashboard/freelancer/coming-soon";

export default function EarningsPage() {
  return (
    <ComingSoon
      title="Earnings"
      description="Payout history and upcoming invoices land here soon."
      icon={Wallet}
    />
  );
}
