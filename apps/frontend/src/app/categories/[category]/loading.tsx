import { Footer } from "@/components/layout/footer";
import { Navbar } from "@/components/layout/navbar";

export default function CategoryLoading() {
  return (
    <div className="flex min-h-screen min-w-0 flex-col overflow-x-clip bg-white">
      <Navbar />
      <main className="flex-1 px-4 pb-20 pt-28 sm:px-8 sm:pb-24 sm:pt-32 lg:px-10">
        <div
          className="mx-auto max-w-7xl animate-pulse"
          aria-label="Loading category"
          aria-busy="true"
          role="status"
        >
          <div className="h-11 w-36 rounded-full bg-muted" />
          <div className="mt-4 flex min-h-[360px] flex-col items-center justify-center rounded-[28px] bg-navy px-5 py-14 sm:min-h-[420px] sm:rounded-[36px]">
            <div className="size-12 rounded-2xl bg-white/15" />
            <div className="mt-6 h-10 w-64 max-w-[80%] rounded-lg bg-white/15" />
            <div className="mt-4 h-5 w-48 max-w-[65%] rounded bg-white/10" />
            <div className="mt-4 h-4 w-full max-w-md rounded bg-white/10" />
          </div>
          <div className="py-16 sm:py-20">
            <div className="h-4 w-32 rounded bg-muted" />
            <div className="mt-4 h-8 w-72 max-w-[85%] rounded-lg bg-muted" />
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 3 }, (_, index) => (
                <div key={index} className="h-56 rounded-3xl border border-border bg-card" />
              ))}
            </div>
          </div>
          <span className="sr-only">Loading category details.</span>
        </div>
      </main>
      <Footer />
    </div>
  );
}
