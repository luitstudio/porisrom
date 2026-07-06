import { Star } from "lucide-react";

import { ComingSoon } from "@/components/dashboard/freelancer/coming-soon";

export default function ReviewsPage() {
  return (
    <ComingSoon
      title="Reviews"
      description="Client ratings and testimonials will appear here soon."
      icon={Star}
    />
  );
}
