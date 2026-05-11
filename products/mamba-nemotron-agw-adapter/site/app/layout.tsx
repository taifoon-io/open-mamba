import type { Metadata, Viewport } from 'next';
import { Inter, Source_Serif_4, JetBrains_Mono } from 'next/font/google';
import { Nav } from '@/components/Nav';
import { Footer } from '@/components/Footer';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-sans',
  weight: ['400', '600'],
});

const serif = Source_Serif_4({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-serif',
  weight: ['400', '600'],
  style: ['normal', 'italic'],
});

const mono = JetBrains_Mono({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-mono',
  weight: ['400', '500'],
});

export const metadata: Metadata = {
  metadataBase: new URL('https://mamba.taifoon.dev'),
  title: {
    default: 'mamba-nemotron-agw-adapter — governed Nemotron upstream',
    template: '%s · mamba-nemotron-agw-adapter',
  },
  description:
    'An OpenAI-compatible upstream that keeps NVIDIA Nemotron behind a certificate, an audit trail, a capability boundary, and a token budget — without rewriting your agents.',
  applicationName: 'mamba-nemotron-agw-adapter',
  keywords: [
    'Solo.io', 'Agentgateway', 'Nemotron', 'NVIDIA', 'LLM gateway',
    'agent OS', 'EU AI Act', 'NIST AI RMF', 'ISO 42001', 'governed AI',
  ],
  authors: [{ name: 'yawningmonsoon', url: 'mailto:maciej@t3rn.io' }],
  creator: 'yawningmonsoon',
  manifest: '/manifest.webmanifest',
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://mamba.taifoon.dev/',
    siteName: 'mamba-nemotron-agw-adapter',
    title: 'Nemotron, governed.',
    description:
      'OpenAI-compatible upstream for Solo.io Agentgateway. Audit, lineage, capability enforcement.',
    images: [
      { url: '/og.png', width: 1200, height: 630, alt: 'mamba-nemotron-agw-adapter — Nemotron, governed.' },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Nemotron, governed.',
    description:
      'OpenAI-compatible upstream for Solo.io Agentgateway. Audit, lineage, capability enforcement.',
    images: ['/og.png'],
  },
  robots: { index: true, follow: true },
  icons: {
    icon: [{ url: '/favicon.svg', type: 'image/svg+xml' }],
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#F5F1E8' },
    { media: '(prefers-color-scheme: dark)',  color: '#1A1916' },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${serif.variable} ${mono.variable}`}>
      <body className="min-h-screen flex flex-col">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:px-3 focus:py-2 focus:bg-ink focus:text-paper focus:rounded-sm"
        >
          Skip to content
        </a>
        <Nav />
        <main id="main" className="flex-1">
          {children}
        </main>
        <Footer />
      </body>
    </html>
  );
}
