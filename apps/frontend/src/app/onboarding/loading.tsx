export default function OnboardingLoading() {
  return (
    <div className="min-h-screen overflow-x-clip bg-background px-3 py-5 min-[375px]:px-4 sm:px-6 sm:py-8">
      <div className="mx-auto w-full max-w-6xl animate-pulse" aria-label="Loading profile setup" aria-busy="true">
        <div className="h-11 w-28 rounded-lg bg-muted" />
        <div className="mt-8 h-2 w-full rounded-full bg-muted" />
        <div className="mt-8 h-8 w-56 max-w-[80%] rounded-lg bg-muted" />
        <div className="mt-3 h-4 w-full max-w-md rounded bg-muted" />
        <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="h-44 rounded-xl bg-muted" />
          <div className="h-44 rounded-xl bg-muted lg:col-span-2" />
          <div className="h-44 rounded-xl bg-muted" />
          <div className="h-44 rounded-xl bg-muted lg:col-span-2" />
        </div>
      </div>
    </div>
  );
}
