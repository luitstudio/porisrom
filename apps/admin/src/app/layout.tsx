import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "Porishrom Admin",
  description: "Internal admin console for Porishrom",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
