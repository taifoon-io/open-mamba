import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "open-mamba — An autonomous task bus for AI agents",
    template: "%s · open-mamba",
  },
  description:
    "Free, MIT-licensed task bus for AI agents. Drop work into a queue, the mamba dispatches it to Claude or your own Nemotron host, and tells you what it cost. Self-hosted in 60 seconds.",
  metadataBase: new URL("https://open-mamba.dev"),
  openGraph: {
    title: "open-mamba — An autonomous task bus for AI agents",
    description: "Free. MIT. Self-hosted. Drop work in, the mamba does the rest.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#0a0c0a",
  colorScheme: "dark",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
