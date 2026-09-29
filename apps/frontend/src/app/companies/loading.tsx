import { Footer } from "@/components/layout/footer";
import { Navbar } from "@/components/layout/navbar";

export default function CompaniesLoading() {
  return (
    <div className="flex min-h-screen min-w-0 flex-col overflow-x-clip">
      <Navbar />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-16 pt-28 sm:px-8 sm:pt-32">
        <div className="animate-pulse" aria-label="Loading companies" aria-busy="true" role="status">
          <div className="h-9 w-52 max-w-[70%] rounded-lg bg-muted" />
          <div className="mt-3 h-4 w-32 rounded bg-muted" />
          <div className="mt-6 grid grid-cols-1 gap-3 min-[430px]:grid-cols-2 sm:grid-cols-4">
            {Array.from({ length: 4 }, (_, index) => (
              <div key={index} className="h-11 rounded-lg bg-muted" />
            ))}
          </div>
          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }, (_, index) => (
              <div key={index} className="h-44 rounded-2xl border border-border bg-card p-5">
                <div className="flex items-center justify-between gap-3">
                  <div className="h-5 w-2/5 rounded bg-muted" />
                  <div className="h-5 w-16 rounded-full bg-muted" />
                </div>
                <div className="mt-3 h-3 w-1/3 rounded bg-muted" />
                <div className="mt-5 h-3 w-full rounded bg-muted" />
                <div className="mt-2 h-3 w-4/5 rounded bg-muted" />
              </div>
            ))}
          </div>
          <span className="sr-only">Loading company discovery results.</span>
        </div>
      </main>
      <Footer />
    </div>
  );
}
