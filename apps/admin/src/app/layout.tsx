import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "Porisrom Admin",
  description: "Internal admin console for Porisrom",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
