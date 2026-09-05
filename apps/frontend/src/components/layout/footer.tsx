import Link from "next/link";

import { BrandLogo } from "@/components/common/brand-logo";
import {
  FacebookIcon,
  InstagramIcon,
  LinkedinIcon,
} from "@/components/common/social-icons";

const CLIENT_LINKS = [
  { label: "Find a Freelancer", href: "/freelancers" },
  { label: "How It Works", href: "/#how-it-works" },
];

const FREELANCER_LINKS = [
  { label: "Find Gigs", href: "/dashboard/freelancer/jobs" },
  { label: "Create Portfolio", href: "/dashboard/freelancer/portfolio" },
  { label: "How It Works", href: "/#how-it-works" },
];

const COMPANY_LINKS = [
  { label: "About Porisrom", href: "/about" },
  { label: "Why Porisrom", href: "/why-porisrom" },
  { label: "Contact Us", href: "/contact" },
];

const SOCIAL_LINKS = [
  { label: "Instagram", icon: InstagramIcon, href: "https://instagram.com" },
  { label: "Facebook", icon: FacebookIcon, href: "https://facebook.com" },
  { label: "LinkedIn", icon: LinkedinIcon, href: "https://linkedin.com" },
];

const LEGAL_DOCUMENTS = [
  { label: "FAQs" },
  { label: "Terms & Conditions", href: "/terms" },
  { label: "Privacy Policy" },
];

type FooterLink = {
  label: string;
  href: string;
};

function FooterLinkList({ links }: { links: FooterLink[] }) {
  return (
    <ul className="flex flex-col gap-3">
      {links.map((link) => (
        <li key={link.label}>
          <Link
            href={link.href}
            className="text-sm text-muted-foreground transition-colors hover:text-primary focus-visible:rounded-sm focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            {link.label}
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function Footer() {
  return (
    <footer className="bg-linear-to-b from-peach to-blush px-5 pb-10 pt-16 sm:px-8 sm:pb-12 lg:px-10">
      <div className="mx-auto max-w-7xl overflow-hidden rounded-3xl bg-white p-6 sm:p-10 lg:p-12">
        <div className="grid gap-8 border-b border-border pb-10 lg:grid-cols-[0.8fr_1.2fr] lg:items-end lg:gap-16">
          <div>
            <Link
              href="/"
              aria-label="Porisrom homepage"
              className="inline-flex rounded-md focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              <BrandLogo className="h-9 sm:h-10" />
            </Link>
            <h2 className="mt-6 font-display text-3xl font-semibold leading-tight text-foreground sm:text-4xl">
              One Platform. Endless Opportunities.
            </h2>
          </div>

          <div>
            <p className="max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">
              Where skills meet opportunities. Porisrom makes it easier for clients to
              find the right talent and for freelancers to showcase their skills,
              discover projects, and grow their work.
            </p>
            <p className="mt-5 font-display text-lg font-semibold text-primary">
              Connect. Collaborate. Create.
            </p>
          </div>
        </div>

        <div className="grid gap-10 py-10 sm:grid-cols-2 lg:grid-cols-[0.8fr_0.8fr_0.8fr_1.35fr_0.8fr] lg:gap-8">
          <div>
            <h3 className="mb-5 text-sm font-semibold text-foreground">For Clients</h3>
            <FooterLinkList links={CLIENT_LINKS} />
          </div>

          <div>
            <h3 className="mb-5 text-sm font-semibold text-foreground">For Freelancers</h3>
            <FooterLinkList links={FREELANCER_LINKS} />
          </div>

          <div>
            <h3 className="mb-5 text-sm font-semibold text-foreground">Company</h3>
            <FooterLinkList links={COMPANY_LINKS} />
          </div>

          <div>
            <h3 className="text-sm font-semibold text-foreground">Support</h3>
            <Link
              href="/help"
              className="mt-5 inline-flex text-sm text-muted-foreground transition-colors hover:text-primary focus-visible:rounded-sm focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              Help Center
            </Link>

            <ul className="mt-5 flex flex-col gap-3" aria-label="Legal documents">
              {LEGAL_DOCUMENTS.map((document) => (
                <li key={document.label}>
                  {document.href ? (
                    <Link
                      href={document.href}
                      className="text-sm text-muted-foreground transition-colors hover:text-primary focus-visible:rounded-sm focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                    >
                      {document.label}
                    </Link>
                  ) : (
                    <span
                      className="text-sm text-muted-foreground/65"
                      aria-disabled="true"
                      title="Document not yet available"
                    >
                      {document.label}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="mb-5 text-sm font-semibold text-foreground">Follow Us</h3>
            <ul className="flex flex-col gap-3">
              {SOCIAL_LINKS.map(({ label, icon: Icon, href }) => (
                <li key={label}>
                  <a
                    href={href}
                    target="_blank"
                    rel="noreferrer"
                    className="group inline-flex items-center gap-2.5 text-sm text-muted-foreground transition-colors hover:text-primary focus-visible:rounded-sm focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                  >
                    <span className="flex size-8 items-center justify-center rounded-full border border-border transition-colors group-hover:border-primary/30 group-hover:bg-lavender">
                      <Icon className="size-4" aria-hidden="true" />
                    </span>
                    {label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="border-t border-border pt-6">
          <p className="text-center text-xs text-muted-foreground sm:text-left">
            © 2026 Porisrom. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
