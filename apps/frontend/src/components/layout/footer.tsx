import Link from "next/link";

import { NewsletterForm } from "@/components/layout/newsletter-form";
import {
  FacebookIcon,
  InstagramIcon,
  LinkedinIcon,
  TwitterIcon,
} from "@/components/common/social-icons";

const QUICK_LINKS = [
  { label: "About Us", href: "/about" },
  { label: "Service", href: "/services" },
  { label: "Contact Us", href: "/contact" },
  { label: "Blog Post", href: "/blog" },
  { label: "Team Members", href: "/team" },
];

const LEGAL_LINKS = [
  { label: "Term & Condition", href: "/terms" },
  { label: "Privacy Policy", href: "/privacy" },
  { label: "Contact Us", href: "/contact" },
];

const SOCIAL_LINKS = [
  { label: "Facebook", icon: FacebookIcon, href: "https://facebook.com" },
  { label: "X", icon: TwitterIcon, href: "https://twitter.com" },
  { label: "Instagram", icon: InstagramIcon, href: "https://instagram.com" },
  { label: "LinkedIn", icon: LinkedinIcon, href: "https://linkedin.com" },
];

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="bg-linear-to-b from-peach to-blush px-5 pb-10 pt-16 sm:px-8 sm:pb-12 lg:px-10">
      <div className="mx-auto max-w-7xl rounded-3xl bg-white p-6 sm:p-10 lg:p-12">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1.3fr_0.7fr_1fr]">
          <div className="flex flex-col gap-5">
            <h2 className="max-w-sm font-display text-3xl font-semibold leading-tight text-foreground sm:text-4xl">
              Designing Your Tomorrow
            </h2>
            <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
              Porisrom helps freelancers grow their careers with matched
              work, clean workspaces, and on-time payments.
            </p>
            <div className="flex items-center gap-3">
              {SOCIAL_LINKS.map(({ label, icon: Icon, href }) => (
                <a
                  key={label}
                  href={href}
                  aria-label={label}
                  target="_blank"
                  rel="noreferrer"
                  className="flex size-9 items-center justify-center rounded-full border border-border text-foreground/70 hover:bg-muted hover:text-foreground"
                >
                  <Icon className="size-4" />
                </a>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <h3 className="text-sm font-semibold text-foreground">
              Quick Link
            </h3>
            <ul className="flex flex-col gap-3">
              {QUICK_LINKS.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="text-sm text-muted-foreground hover:text-foreground"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex flex-col gap-4">
            <h3 className="text-sm font-semibold text-foreground">
              Newsletter
            </h3>
            <p className="text-sm text-muted-foreground">
              Get freelance tips and new gig drops in your inbox.
            </p>
            <NewsletterForm />
          </div>
        </div>

        <div className="mt-10 flex flex-col items-center justify-between gap-4 border-t border-border pt-6 sm:flex-row">
          <p className="text-xs text-muted-foreground">
            © Porisrom {year}. All Rights Reserved
          </p>
          <ul className="flex flex-wrap items-center justify-center gap-5">
            {LEGAL_LINKS.map((link) => (
              <li key={link.label}>
                <Link
                  href={link.href}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </footer>
  );
}
