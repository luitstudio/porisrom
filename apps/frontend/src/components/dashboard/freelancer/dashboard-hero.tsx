type DashboardHeroProps = {
  firstName: string;
  greeting: string;
  activeOpportunities: number;
};

export function DashboardHero({ firstName, greeting, activeOpportunities }: DashboardHeroProps) {
  return (
    <div>
      <h1 className="font-display text-2xl font-semibold text-foreground sm:text-3xl">
        {greeting}, {firstName} 👋
      </h1>
      <p className="mt-1.5 text-sm text-muted-foreground">
        You have <span className="font-medium text-foreground">{activeOpportunities} active opportunities</span>{" "}
        waiting for you.
      </p>
    </div>
  );
}
