import Link from "next/link";
import {
  ArrowLeft,
  Check,
  FileCheck2,
  Landmark,
  Scale,
  ShieldCheck,
} from "lucide-react";
import type { Metadata } from "next";

import { auth } from "@/auth";
import { Footer } from "@/components/layout/footer";
import { Navbar } from "@/components/layout/navbar";

export const metadata: Metadata = {
  title: "Terms & Conditions — Porisrom",
  description: "Terms and conditions governing the use of the Porisrom marketplace.",
};

type TermsGroup = {
  title: string;
  paragraphs?: string[];
  bullets?: string[];
};

type TermsSection = {
  id: string;
  title: string;
  paragraphs?: string[];
  bullets?: string[];
  groups?: TermsGroup[];
};

const TERMS_SECTIONS: TermsSection[] = [
  {
    id: "definitions",
    title: "1. Definitions",
    bullets: [
      "Freelancer: A registered user offering professional services through Porisrom.",
      "Client: A registered user seeking to hire freelancers.",
      "User: Any individual or organisation accessing the Platform.",
      "Platform: The Porisrom website and associated services.",
    ],
  },
  {
    id: "eligibility",
    title: "2. Eligibility",
    bullets: [
      "Users must be at least 18 years old.",
      "Users must be legally capable of entering into contracts.",
      "Registration information must be accurate.",
      "Users are responsible for maintaining account confidentiality.",
    ],
  },
  {
    id: "nature-of-services",
    title: "3. Nature of Services",
    paragraphs: [
      "Porisrom acts solely as a platform connecting freelancers and clients. Porisrom does not employ freelancers, negotiate contracts, supervise projects, guarantee work, or participate in agreements between users.",
    ],
  },
  {
    id: "registration",
    title: "4. Registration",
    paragraphs: [
      "Users must register to access certain features and provide accurate information. Fake or misleading profiles are prohibited.",
    ],
  },
  {
    id: "user-responsibilities",
    title: "5. User Responsibilities",
    groups: [
      {
        title: "Freelancers agree to",
        bullets: [
          "Provide truthful information.",
          "Deliver work professionally.",
          "Respect deadlines and confidentiality.",
          "Deliver original work.",
        ],
      },
      {
        title: "Clients agree to",
        bullets: [
          "Provide clear project requirements.",
          "Honour agreed payment terms.",
          "Treat freelancers respectfully.",
        ],
      },
    ],
  },
  {
    id: "payments-payouts",
    title: "6. Payments & Payouts",
    groups: [
      {
        title: "Direct Transactions",
        paragraphs: [
          "Porisrom does not collect, receive, process, hold, manage, or facilitate payments between clients and freelancers.",
          "All payment terms—including pricing, milestones, payment methods, advances, and final settlements—must be agreed directly between the client and freelancer.",
        ],
      },
      {
        title: "Payment Disputes",
        paragraphs: [
          "Porisrom is not responsible for delayed payments, non-payment, partial payments, refunds, chargebacks, fraudulent financial transactions, or any payment-related dispute. Users must resolve such issues directly with one another.",
        ],
      },
      {
        title: "Payout Responsibility",
        paragraphs: [
          "Freelancers receive payments directly from clients. Porisrom does not provide escrow, wallet, or payout services and does not guarantee payment.",
        ],
      },
      {
        title: "User Acknowledgement",
        paragraphs: [
          "All financial transactions are conducted entirely at the users’ own discretion and risk.",
        ],
      },
    ],
  },
  {
    id: "privacy-data-protection",
    title: "7. Privacy & Data Protection",
    paragraphs: [
      "Porisrom collects information necessary to operate the Platform, including names, contact details, portfolios, and professional information. Personal information is used to operate the Platform, improve services, and prevent fraud. Porisrom does not sell users’ personal information.",
    ],
  },
  {
    id: "intellectual-property",
    title: "8. Intellectual Property",
    paragraphs: [
      "Freelancers retain ownership of their work until ownership is transferred under their agreement with the client. Users may not copy or misuse another user’s work.",
    ],
  },
  {
    id: "code-of-conduct",
    title: "9. Code of Conduct",
    paragraphs: [
      "Users must not upload false information, impersonate others, harass users, upload harmful software, infringe intellectual property, or engage in fraud or illegal activities.",
    ],
  },
  {
    id: "reviews-ratings",
    title: "10. Reviews & Ratings",
    paragraphs: [
      "Reviews must be truthful, respectful, and related to completed projects. Porisrom may remove fake or abusive reviews.",
    ],
  },
  {
    id: "limitation-of-liability",
    title: "11. Limitation of Liability",
    paragraphs: [
      "Porisrom is only a technology platform and is not liable for project quality, missed deadlines, payment failures, copyright disputes, financial losses, or damages arising from interactions between users.",
    ],
  },
  {
    id: "disputes",
    title: "12. Disputes",
    paragraphs: [
      "Clients and freelancers should first resolve disputes directly. Porisrom may facilitate communication but is not obligated to investigate or resolve disputes.",
    ],
  },
  {
    id: "suspension-termination",
    title: "13. Suspension & Termination",
    paragraphs: [
      "Accounts may be suspended or terminated for violations of these Terms, fraudulent activities, fake identities, or misuse of the Platform.",
    ],
  },
  {
    id: "website-availability",
    title: "14. Website Availability",
    paragraphs: [
      "Porisrom may suspend or interrupt services for maintenance, security, or technical reasons and shall not be liable for resulting losses.",
    ],
  },
  {
    id: "third-party-links",
    title: "15. Third-Party Links",
    paragraphs: [
      "Porisrom is not responsible for third-party websites or services linked from the Platform.",
    ],
  },
  {
    id: "changes-to-terms",
    title: "16. Changes to Terms",
    paragraphs: [
      "These Terms may be updated at any time. Continued use of the Platform constitutes acceptance of the revised Terms.",
    ],
  },
  {
    id: "governing-law",
    title: "17. Governing Law",
    paragraphs: [
      "These Terms are governed by the laws of India. Any disputes shall be subject to the jurisdiction of the competent courts where Porisrom’s registered office is located.",
    ],
  },
  {
    id: "contact-us",
    title: "18. Contact Us",
    paragraphs: ["For questions about these Terms, contact support@porisrom.com."],
  },
];

const ADDITIONAL_CLAUSES = [
  "No Employment Relationship",
  "Independent Contractor Status",
  "No Guarantee of Work",
  "Profile Verification Disclaimer",
  "Anti-Spam and Anti-Abuse Policy",
  "Force Majeure",
];

export default async function TermsPage() {
  const session = await auth();
  const isAuthenticated = Boolean(
    session?.user?.id && session.accessToken && !session.error
  );

  return (
    <div className="flex min-h-screen flex-col overflow-x-hidden bg-white">
      <Navbar isAuthenticated={isAuthenticated} />

      <main className="flex-1 px-5 pb-20 pt-28 sm:px-8 sm:pb-24 sm:pt-32 lg:px-10">
        <div className="mx-auto max-w-7xl">
          <Link
            href="/"
            className="inline-flex min-h-11 items-center gap-2 rounded-full px-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Back to homepage
          </Link>

          <section className="relative mt-4 isolate overflow-hidden rounded-[30px] bg-navy px-6 py-14 text-white sm:rounded-[38px] sm:px-10 sm:py-18 lg:px-16 lg:py-20">
            <div className="absolute inset-0 -z-10 bg-linear-to-br from-primary/35 via-transparent to-orchid/30" />
            <div className="absolute -left-24 -top-24 -z-10 size-72 rounded-full border border-white/10" />
            <div className="absolute -bottom-36 right-[-4%] -z-10 size-96 rounded-full bg-primary/20 blur-2xl" />

            <div className="grid items-center gap-12 lg:grid-cols-[1.1fr_0.9fr]">
              <div className="max-w-3xl">
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-lavender">
                  Porisrom legal
                </p>
                <h1 className="mt-4 font-display text-4xl font-semibold leading-tight sm:text-5xl lg:text-6xl">
                  Terms & Conditions
                </h1>
                <p className="mt-6 max-w-2xl text-base leading-7 text-white/70 sm:text-lg sm:leading-8">
                  Welcome to Porisrom. These terms explain the rules, responsibilities,
                  and protections that apply when clients and freelancers use our
                  marketplace.
                </p>
              </div>

              <LegalIllustration />
            </div>
          </section>

          <div className="mt-12 grid items-start gap-10 lg:grid-cols-[260px_minmax(0,1fr)] lg:gap-14">
            <aside className="lg:sticky lg:top-28">
              <div className="rounded-3xl border border-border bg-lavender/35 p-5">
                <h2 className="font-display text-lg font-semibold text-foreground">
                  On this page
                </h2>
                <nav className="mt-4 max-h-[60vh] overflow-y-auto pr-2" aria-label="Terms sections">
                  <ol className="flex flex-col gap-1">
                    {TERMS_SECTIONS.map((section) => (
                      <li key={section.id}>
                        <a
                          href={`#${section.id}`}
                          className="block rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-white hover:text-primary focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                        >
                          {section.title}
                        </a>
                      </li>
                    ))}
                  </ol>
                </nav>
              </div>
            </aside>

            <article className="min-w-0">
              <div className="rounded-3xl border border-primary/15 bg-peach/55 p-6 sm:p-8">
                <h2 className="font-display text-2xl font-semibold text-foreground">
                  Welcome to Porisrom
                </h2>
                <p className="mt-4 text-sm leading-7 text-muted-foreground sm:text-base">
                  Porisrom is an online marketplace that connects freelance professionals
                  (“Freelancers”) with individuals, businesses, and organisations
                  (“Clients”) seeking creative and professional services.
                </p>
                <p className="mt-3 text-sm leading-7 text-muted-foreground sm:text-base">
                  By accessing or using Porisrom, you agree to comply with these Terms &
                  Conditions. If you do not agree, please do not use the Platform.
                </p>
              </div>

              <div className="mt-6 flex flex-col gap-4">
                {TERMS_SECTIONS.map((section) => (
                  <TermsArticleSection key={section.id} section={section} />
                ))}
              </div>

              <section className="mt-6 rounded-3xl bg-navy p-6 text-white sm:p-8">
                <div className="flex items-center gap-3">
                  <ShieldCheck className="size-6 text-lavender" aria-hidden="true" />
                  <h2 className="font-display text-2xl font-semibold">Additional Clauses</h2>
                </div>
                <ul className="mt-6 grid gap-3 sm:grid-cols-2">
                  {ADDITIONAL_CLAUSES.map((clause) => (
                    <li key={clause} className="flex items-start gap-3 text-sm text-white/75">
                      <Check className="mt-0.5 size-4 shrink-0 text-lavender" aria-hidden="true" />
                      {clause}
                    </li>
                  ))}
                </ul>
              </section>
            </article>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}

function TermsArticleSection({ section }: { section: TermsSection }) {
  return (
    <section
      id={section.id}
      className="scroll-mt-28 rounded-3xl border border-border bg-white p-6 shadow-[0_18px_50px_-42px_rgba(20,21,43,0.45)] sm:p-8"
    >
      <h2 className="font-display text-2xl font-semibold text-foreground">{section.title}</h2>

      {section.paragraphs?.map((paragraph) => (
        <p key={paragraph} className="mt-4 text-sm leading-7 text-muted-foreground sm:text-base">
          {paragraph}
        </p>
      ))}

      {section.bullets && <TermsList items={section.bullets} />}

      {section.groups?.map((group) => (
        <div key={group.title} className="mt-6 first:mt-4">
          <h3 className="text-base font-semibold text-foreground">{group.title}</h3>
          {group.paragraphs?.map((paragraph) => (
            <p key={paragraph} className="mt-3 text-sm leading-7 text-muted-foreground sm:text-base">
              {paragraph}
            </p>
          ))}
          {group.bullets && <TermsList items={group.bullets} />}
        </div>
      ))}
    </section>
  );
}

function TermsList({ items }: { items: string[] }) {
  return (
    <ul className="mt-4 flex flex-col gap-3">
      {items.map((item) => (
        <li key={item} className="flex items-start gap-3 text-sm leading-6 text-muted-foreground sm:text-base">
          <Check className="mt-1 size-4 shrink-0 text-primary" aria-hidden="true" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function LegalIllustration() {
  return (
    <div className="relative mx-auto h-64 w-full max-w-sm" aria-hidden="true">
      <div className="absolute left-2 top-9 h-44 w-36 -rotate-6 rounded-3xl border border-white/15 bg-white/8 p-5 backdrop-blur-sm sm:left-8 sm:w-40">
        <Landmark className="size-8 text-lavender" />
        <div className="mt-6 h-2 w-20 rounded-full bg-white/20" />
        <div className="mt-3 h-2 w-14 rounded-full bg-white/12" />
      </div>
      <div className="absolute right-1 top-3 h-52 w-44 rotate-5 rounded-3xl border border-white/20 bg-white/12 p-6 shadow-2xl backdrop-blur-md sm:right-7 sm:w-48">
        <FileCheck2 className="size-10 text-white" />
        <div className="mt-6 flex flex-col gap-3">
          {["w-full", "w-4/5", "w-3/5"].map((width) => (
            <div key={width} className={`h-2 rounded-full bg-white/20 ${width}`} />
          ))}
        </div>
      </div>
      <div className="absolute bottom-0 left-1/2 flex size-20 -translate-x-1/2 items-center justify-center rounded-3xl bg-primary text-white shadow-[0_24px_50px_-18px_rgba(100,94,238,0.9)]">
        <Scale className="size-9" />
      </div>
    </div>
  );
}
