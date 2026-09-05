import { auth } from "@/auth";
import { HeroSection } from "@/components/home/hero-section";
import { ServicesSection } from "@/components/home/services-section";
import { CategorySection } from "@/components/home/category-section";
import { MobileDiscovery } from "@/components/home/mobile-discovery";
import { MobileBottomNav } from "@/components/home/mobile-bottom-nav";
import { HowItWorksSection } from "@/components/home/how-it-works-section";
import { FeaturesSection } from "@/components/home/features-section";
import { FeatureHighlights } from "@/components/home/feature-highlights";
import { StatsStrip } from "@/components/home/stats-strip";
import { TestimonialSection } from "@/components/home/testimonial-section";
import { Footer } from "@/components/layout/footer";

export default async function Home() {
  const session = await auth();
  const isAuthenticated = Boolean(
    session?.user?.id && session.accessToken && !session.error
  );

  return (
    <div className={`flex flex-1 flex-col ${isAuthenticated ? "pb-24 lg:pb-0" : ""}`}>
      <main className="flex-1">
        <HeroSection isAuthenticated={isAuthenticated} />
        <ServicesSection />
        <CategorySection />
        <div className="flex flex-col gap-12 px-5 py-12 lg:hidden">
          <FeatureHighlights />
          <StatsStrip />
          <MobileDiscovery />
        </div>
        <HowItWorksSection />
        <FeaturesSection />
        <TestimonialSection />
      </main>
      <Footer />
      <MobileBottomNav isAuthenticated={isAuthenticated} />
    </div>
  );
}
