import {
  Camera,
  Clapperboard,
  Code2,
  Languages,
  Megaphone,
  Mic,
  PenTool,
  PlaneTakeoff,
  Shapes,
  Sparkles,
} from "lucide-react";

import { MobileMarketplaceRow } from "@/components/home/mobile-marketplace-row";
import { MobileServiceCard } from "@/components/home/mobile-service-card";
import { CANONICAL_CATEGORIES, categoryHref } from "@/lib/service-categories";

const DISCOVERY_CATEGORIES = [
  { ...CANONICAL_CATEGORIES.videoEditor, icon: Clapperboard },
  { ...CANONICAL_CATEGORIES.videographerPhotographer, icon: Camera },
  { ...CANONICAL_CATEGORIES.graphicDesigner, icon: PenTool },
  { ...CANONICAL_CATEGORIES.webDeveloper, icon: Code2 },
  { ...CANONICAL_CATEGORIES.motionDesigner, icon: Sparkles },
  { ...CANONICAL_CATEGORIES.droneOperator, icon: PlaneTakeoff },
  { ...CANONICAL_CATEGORIES.contentWriter, icon: Languages },
  { ...CANONICAL_CATEGORIES.socialMediaMarketer, icon: Megaphone },
  { ...CANONICAL_CATEGORIES.voiceOverArtist, icon: Mic },
];

export function MobileDiscovery() {
  return (
    <div className="flex flex-col gap-12">
      <MobileMarketplaceRow icon={Shapes} title="Explore Categories" viewAllHref="/freelancers">
        {DISCOVERY_CATEGORIES.map((category) => (
          <MobileServiceCard
            key={category.slug}
            icon={category.icon}
            title={category.name}
            meta="Browse category"
            href={categoryHref(category)}
          />
        ))}
      </MobileMarketplaceRow>
    </div>
  );
}
