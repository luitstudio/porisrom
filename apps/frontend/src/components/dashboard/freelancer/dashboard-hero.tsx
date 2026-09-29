type DashboardHeroProps = {
  firstName: string;
  greeting: string;
};

export function DashboardHero({ firstName, greeting }: DashboardHeroProps) {
  return (
    <div className="min-w-0">
      <h1 className="break-words font-display text-xl font-semibold leading-tight text-foreground min-[375px]:text-2xl sm:text-3xl">
        {greeting}, {firstName} 👋
      </h1>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
        Manage your profile, portfolio, connections, and client conversations.
      </p>
    </div>
  );
}
