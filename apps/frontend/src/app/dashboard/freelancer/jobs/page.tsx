import { Briefcase } from "lucide-react";

import { ComingSoon } from "@/components/dashboard/freelancer/coming-soon";

export default function JobsPage() {
  return (
    <ComingSoon
      title="Jobs"
      description="Browse and filter matched opportunities here soon."
      icon={Briefcase}
    />
  );
}
