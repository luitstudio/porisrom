import { Image as ImageIcon } from "lucide-react";

import { ComingSoon } from "@/components/dashboard/freelancer/coming-soon";

export default function PortfolioPage() {
  return (
    <ComingSoon
      title="Portfolio"
      description="Manage projects and case studies here soon."
      icon={ImageIcon}
    />
  );
}
