import { FileText } from "lucide-react";

import { ComingSoon } from "@/components/dashboard/freelancer/coming-soon";

export default function ApplicationsPage() {
  return (
    <ComingSoon
      title="Applications"
      description="Track every application's stage in one place soon."
      icon={FileText}
    />
  );
}
