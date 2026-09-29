import Image from "next/image";
import Link from "next/link";
import {
  ArrowUpRight,
  BriefcaseBusiness,
  Check,
  MessageCircle,
  Search,
} from "lucide-react";

const editorialCard =
  "group relative min-w-0 overflow-hidden rounded-[24px] transition-transform duration-300 hover:-translate-y-1 motion-reduce:transform-none sm:rounded-[28px]";

export function FeaturesSection() {
  return (
    <section className="bg-[#141512] py-6 sm:py-8 lg:py-12" aria-labelledby="porishrom-story-title">
      <div className="mx-auto max-w-[1440px] px-3 sm:px-5 lg:px-7">
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-12 lg:gap-4">
          <article className={`${editorialCard} min-h-[330px] bg-[#f7f3e9] p-6 text-[#141512] sm:min-h-[390px] sm:p-8 lg:col-span-8 lg:min-h-[420px] lg:p-10`}>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#e63228] sm:text-xs">Porishrom marketplace</p>
            <h2 id="porishrom-story-title" className="relative z-10 mt-7 max-w-[8ch] font-display text-5xl font-semibold leading-[0.83] tracking-[-0.065em] sm:text-7xl lg:text-[6.8rem]">
              Good work.<br />Right people.
            </h2>
            <p className="relative z-10 mt-7 max-w-[30rem] text-sm leading-6 text-[#3d3a32] sm:text-base sm:leading-7">
              Build a profile, find the people your project needs, and move from a conversation to completed work in one place.
            </p>
            <Link href="/freelancers" className="relative z-10 mt-7 inline-flex min-h-11 items-center gap-2 rounded-full bg-[#141512] px-4 text-sm font-semibold text-[#f7f3e9] transition-transform hover:translate-x-1 focus-visible:ring-3 focus-visible:ring-[#e63228] focus-visible:outline-none motion-reduce:transform-none">
              Find professionals <ArrowUpRight className="size-4" aria-hidden="true" />
            </Link>
            <Image src="/illustrations/porishrom-editorial/marketplace-people-transparent.png" alt="Hand-drawn Porishrom freelancers and a client working together" width={960} height={960} sizes="(min-width: 1024px) 42vw, 70vw" className="pointer-events-none absolute -bottom-8 -right-14 h-auto w-[58%] max-w-[440px] transition-transform duration-300 group-hover:-translate-y-2 group-hover:rotate-1 motion-reduce:transform-none sm:-right-8 sm:w-[52%]" />
            <span className="absolute bottom-7 left-[49%] hidden size-3 rounded-full bg-[#9be65b] lg:block" aria-hidden="true" />
          </article>

          <article className={`${editorialCard} min-h-[300px] bg-[#075a50] p-6 text-[#f7f3e9] sm:min-h-[390px] sm:p-8 lg:col-span-4 lg:min-h-[420px]`}>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#9be65b] sm:text-xs">Made for connection</p>
            <div className="absolute -left-10 -top-14 size-52 rounded-full border-[18px] border-[#9be65b]/25" aria-hidden="true" />
            <div className="relative mt-9 max-w-[13rem] rounded-[20px] bg-[#141512] px-5 py-4 font-mono text-lg font-bold leading-tight shadow-[0_18px_30px_-18px_rgba(0,0,0,0.6)]">
              Let&apos;s make this happen.<span className="absolute -bottom-2 left-7 size-4 rotate-45 bg-[#141512]" aria-hidden="true" />
            </div>
            <div className="absolute bottom-6 left-6 flex -space-x-3 sm:bottom-8 sm:left-8">
              {["M", "R", "S"].map((initial, index) => <span key={initial} className={`flex size-13 items-center justify-center rounded-full border-4 border-[#075a50] text-sm font-bold text-[#141512] ${index === 0 ? "bg-[#f7f3e9]" : index === 1 ? "bg-[#9be65b]" : "bg-[#e63228] text-[#f7f3e9]"}`}>{initial}</span>)}
            </div>
            <Image src="/illustrations/porishrom-editorial/collaboration-chat.png" alt="Hand-drawn people exchanging a project brief" width={900} height={900} sizes="(min-width: 1024px) 26vw, 65vw" className="pointer-events-none absolute -bottom-10 -right-12 h-auto w-[73%] max-w-[330px] transition-transform duration-300 group-hover:-translate-y-2 group-hover:translate-x-1 motion-reduce:transform-none" />
          </article>

          <article className={`${editorialCard} min-h-[320px] bg-[#e63228] p-5 text-[#f7f3e9] sm:p-7 lg:col-span-4 lg:min-h-[420px]`}>
            <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-[0.18em] sm:text-xs"><span>01 / Discover</span><Search className="size-4" aria-hidden="true" /></div>
            <div className="mt-6 flex min-h-[218px] flex-col rounded-[22px] bg-[#f7f3e9] p-6 text-[#e63228] sm:min-h-[275px] sm:p-7">
              <p className="font-display text-4xl font-semibold leading-[0.88] tracking-[-0.06em] sm:text-5xl">Find your<br />next project.</p>
              <div className="mt-auto flex items-end justify-between gap-4"><span className="max-w-[13rem] text-xs font-bold leading-5 text-[#7d201d]">Search approved companies and start a direct connection.</span><BriefcaseBusiness className="size-11 shrink-0 stroke-[1.4]" aria-hidden="true" /></div>
            </div>
          </article>

          <article className={`${editorialCard} min-h-[320px] bg-[#f7f3e9] p-6 text-[#141512] sm:p-8 lg:col-span-5 lg:min-h-[420px]`}>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#075a50] sm:text-xs">The work moves forward</p>
            <h3 className="mt-6 max-w-[8ch] font-display text-4xl font-semibold leading-[0.9] tracking-[-0.055em] sm:text-5xl">Clear from hello to handoff.</h3>
            <div className="absolute bottom-7 left-6 right-6 flex flex-col gap-2 sm:bottom-8 sm:left-8 sm:right-8">
              <div className="flex max-w-[18rem] items-center gap-3 self-start rounded-2xl bg-[#075a50] px-4 py-3 text-sm font-semibold text-[#f7f3e9] shadow-sm"><MessageCircle className="size-4 shrink-0" aria-hidden="true" />I&apos;m ready to get started.</div>
              <div className="flex max-w-[16rem] items-center gap-3 self-end rounded-2xl bg-[#9be65b] px-4 py-3 text-sm font-semibold text-[#141512] shadow-sm"><Check className="size-4 shrink-0" aria-hidden="true" />Assignment accepted.</div>
            </div>
          </article>

          <article className={`${editorialCard} min-h-[320px] bg-[#f7f3e9] p-6 text-[#141512] sm:p-8 lg:col-span-3 lg:min-h-[420px]`}>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#e63228] sm:text-xs">Work with confidence</p>
            <h3 className="mt-6 font-display text-4xl font-semibold leading-[0.88] tracking-[-0.06em] sm:text-5xl">Build a profile worth finding.</h3>
            <div className="absolute bottom-7 left-6 right-6 border-t-2 border-[#141512] pt-3 text-xs font-bold uppercase tracking-[0.16em] text-[#5e5a50] sm:bottom-8 sm:left-8 sm:right-8">Skills · portfolio · reviews</div>
            <span className="absolute right-7 top-7 text-5xl text-[#9be65b]" aria-hidden="true">↗</span>
          </article>
        </div>
      </div>
    </section>
  );
}
