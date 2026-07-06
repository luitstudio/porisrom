import {
  Briefcase,
  Camera,
  Clapperboard,
  Code2,
  Mic,
  Palette,
  PenTool,
  Star,
  TrendingUp,
} from "lucide-react";

import { MobileMarketplaceRow } from "@/components/home/mobile-marketplace-row";
import { MobileServiceCard } from "@/components/home/mobile-service-card";
import { MobileFreelancerCard } from "@/components/home/mobile-freelancer-card";

const TRENDING_SERVICES = [
  { icon: Clapperboard, title: "Reels Editing", meta: "From ₹999" },
  { icon: PenTool, title: "Logo Design", meta: "From ₹1,499" },
  { icon: Code2, title: "Landing Page", meta: "From ₹4,999" },
  { icon: Camera, title: "Product Shoot", meta: "From ₹2,999" },
  { icon: Mic, title: "Voice Over", meta: "From ₹799" },
];

const TOP_RATED_FREELANCERS = [
  { name: "Aarav Shah", initials: "AS", role: "Video Editor", rating: "4.9" },
  { name: "Priya Nair", initials: "PN", role: "UI/UX Designer", rating: "5.0" },
  { name: "Rohan Mehta", initials: "RM", role: "Web Developer", rating: "4.8" },
  { name: "Sara Khan", initials: "SK", role: "Content Writer", rating: "4.9" },
];

const RECENTLY_JOINED = [
  { name: "Dev Patel", initials: "DP", role: "Motion Designer" },
  { name: "Ishita Roy", initials: "IR", role: "Photographer" },
  { name: "Kabir Singh", initials: "KS", role: "Digital Marketer" },
  { name: "Meera Iyer", initials: "MI", role: "Graphic Designer" },
];

const CREATIVE_PROFESSIONALS = [
  { name: "Nikhil Verma", initials: "NV", role: "Brand Designer" },
  { name: "Tara Joshi", initials: "TJ", role: "Illustrator" },
  { name: "Yusuf Ali", initials: "YA", role: "Animator" },
  { name: "Zara Kapoor", initials: "ZK", role: "Art Director" },
];

export function MobileDiscovery() {
  return (
    <div className="flex flex-col gap-12">
      <MobileMarketplaceRow icon={TrendingUp} title="Trending Services" viewAllHref="/freelancers">
        {TRENDING_SERVICES.map((service) => (
          <MobileServiceCard
            key={service.title}
            icon={service.icon}
            title={service.title}
            meta={service.meta}
            href="/freelancers"
          />
        ))}
      </MobileMarketplaceRow>

      <MobileMarketplaceRow icon={Star} title="Top Rated Freelancers" viewAllHref="/freelancers">
        {TOP_RATED_FREELANCERS.map((freelancer) => (
          <MobileFreelancerCard
            key={freelancer.name}
            name={freelancer.name}
            initials={freelancer.initials}
            role={freelancer.role}
            href="/freelancers"
            badge={{ type: "rating", value: freelancer.rating }}
          />
        ))}
      </MobileMarketplaceRow>

      <MobileMarketplaceRow icon={Briefcase} title="Recently Joined Talent" viewAllHref="/freelancers">
        {RECENTLY_JOINED.map((freelancer) => (
          <MobileFreelancerCard
            key={freelancer.name}
            name={freelancer.name}
            initials={freelancer.initials}
            role={freelancer.role}
            href="/freelancers"
            badge={{
              type: "status",
              label: "New",
              className: "bg-blush text-foreground",
            }}
          />
        ))}
      </MobileMarketplaceRow>

      <MobileMarketplaceRow icon={Palette} title="Creative Professionals" viewAllHref="/freelancers">
        {CREATIVE_PROFESSIONALS.map((freelancer) => (
          <MobileFreelancerCard
            key={freelancer.name}
            name={freelancer.name}
            initials={freelancer.initials}
            role={freelancer.role}
            href="/freelancers"
            badge={{
              type: "status",
              label: "Creative",
              className: "bg-orchid/15 text-orchid",
            }}
          />
        ))}
      </MobileMarketplaceRow>
    </div>
  );
}
