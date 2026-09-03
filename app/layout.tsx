import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Distribution OS — Agentic customer acquisition",
  description: "Turn one website URL into a coordinated marketing, distribution and revenue-learning system powered by specialized AI agents.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
