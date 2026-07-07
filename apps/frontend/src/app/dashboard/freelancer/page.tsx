import { redirect } from "next/navigation";

import { ProfileCompletionBanner } from "@/components/dashboard/profile-completion-banner";
import { getCurrentUser } from "@/lib/current-user";
import { DashboardHero } from "@/components/dashboard/freelancer/dashboard-hero";
import { KpiRow } from "@/components/dashboard/freelancer/kpi-row";
import { KpiCarousel } from "@/components/dashboard/freelancer/kpi-carousel";
import { PerformanceCard } from "@/components/dashboard/freelancer/performance-card";
import { ActiveJobsCard } from "@/components/dashboard/freelancer/active-jobs-card";
import { MessagesCard } from "@/components/dashboard/freelancer/messages-card";
import { PortfolioCard } from "@/components/dashboard/freelancer/portfolio-card";
import { TrendingSkillsCard } from "@/components/dashboard/freelancer/trending-skills-card";
import { MarketPulseCard } from "@/components/dashboard/freelancer/market-pulse-card";
import { ActivityFeedCard } from "@/components/dashboard/freelancer/activity-feed-card";
import { ACTIVE_OPPORTUNITIES_COUNT } from "@/lib/freelancer-dashboard-data";

function greetingForHour(hour: number) {
  if (hour < 12) return "Good Morning";
  if (hour < 18) return "Good Afternoon";
  return "Good Evening";
}

export default async function FreelancerDashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/auth/login");

  const firstName = user.name.split(" ")[0];
  const greeting = greetingForHour(new Date().getHours());

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
      <div className="flex flex-col gap-6">
        <DashboardHero
          firstName={firstName}
          greeting={greeting}
          activeOpportunities={ACTIVE_OPPORTUNITIES_COUNT}
        />

        {user.profileCompleteness < 100 && (
          <ProfileCompletionBanner percent={user.profileCompleteness} ctaHref="/onboarding" />
        )}

        {/* Mobile: native-app style stack */}
        <div className="flex flex-col gap-5 lg:hidden">
          <KpiCarousel />
          <ActiveJobsCard />
          <MessagesCard />
          <ActivityFeedCard title="Notifications" />
          <PortfolioCard />
          <TrendingSkillsCard />
        </div>

        {/* Desktop: bento grid with main workspace + insights rail */}
        <div className="hidden lg:grid lg:grid-cols-12 lg:gap-6">
          <div className="col-span-8 flex flex-col gap-6">
            <KpiRow />
            <PerformanceCard />
            <div className="grid grid-cols-2 gap-6">
              <ActiveJobsCard />
              <PortfolioCard />
            </div>
            <MessagesCard />
          </div>

          <div className="col-span-4 flex flex-col gap-6">
            <TrendingSkillsCard />
            <MarketPulseCard />
            <ActivityFeedCard />
          </div>
        </div>
      </div>
    </div>
  );
}
