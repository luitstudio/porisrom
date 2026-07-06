import type { Metadata } from "next";
import { Outfit, Onest } from "next/font/google";
import "./globals.css";

import { SessionProvider } from "@/components/providers/session-provider";

const sans = Outfit({
  variable: "--font-sans",
  subsets: ["latin"],
});

const display = Onest({
  variable: "--font-display",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Porisrom — Your freelance career, fully in your hand",
  description:
    "Porisrom connects freelancers with matched gigs, organised workspaces, and on-time payments.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${sans.variable} ${display.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground font-sans">
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}
