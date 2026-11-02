import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

import { SessionProvider } from "@/components/providers/session-provider";

const sans = localFont({
  src: "./fonts/Outfit-Variable.ttf",
  weight: "100 900",
  display: "swap",
  variable: "--font-sans",
});

const display = localFont({
  src: "./fonts/Onest-Variable.ttf",
  weight: "100 900",
  display: "swap",
  variable: "--font-display",
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
