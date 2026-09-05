import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Distribution OS — Evidence-grounded distribution",
  description: "Turn one website URL into a governed distribution mission aimed at the first attributable verified payment.",
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
      <head>
        <meta name="codex-preview" content="development" />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
