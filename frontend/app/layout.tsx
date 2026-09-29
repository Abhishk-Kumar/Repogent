import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'
import { Toaster } from 'sonner'

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] })
const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

// Canonical public URL. Set NEXT_PUBLIC_SITE_URL at build time (see
// render.yaml); defaults to the Render deployment. Never hardcode a
// domain anywhere else — metadataBase, OG, canonicals all derive from this.
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://repogent.onrender.com'
const ogImage = '/og-default.png'

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'CodeAtlas — Understand any codebase in minutes, not weeks',
    template: '%s | CodeAtlas',
  },
  description:
    'CodeAtlas is an AI-powered codebase onboarding agent. Paste a GitHub repo or upload a zip to get an interactive dependency graph, AI chat, security scans, and a plain-English explanation of what the code does.',
  keywords: [
    'codebase analysis',
    'dependency graph',
    'AI code assistant',
    'security scanning',
    'developer tools',
    'code onboarding',
    'MCP server',
  ],
  authors: [{ name: 'CodeAtlas' }],
  creator: 'CodeAtlas',
  publisher: 'CodeAtlas',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  alternates: {
    canonical: '/',
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: siteUrl,
    siteName: 'CodeAtlas',
    title: 'CodeAtlas — Understand any codebase in minutes, not weeks',
    description:
      'CodeAtlas is an AI-powered codebase onboarding agent. Paste a GitHub repo or upload a zip to get an interactive dependency graph, AI chat, security scans, and a plain-English explanation of what the code does.',
    images: [
      {
        url: ogImage,
        width: 1200,
        height: 630,
        alt: 'CodeAtlas — Interactive dependency graph and AI code assistant',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    site: '@FILL-ME-HANDLE',
    creator: '@FILL-ME-HANDLE',
    title: 'CodeAtlas — Understand any codebase in minutes, not weeks',
    description:
      'CodeAtlas is an AI-powered codebase onboarding agent. Paste a GitHub repo or upload a zip to get an interactive dependency graph, AI chat, security scans, and a plain-English explanation of what the code does.',
    images: [ogImage],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/icon.svg', type: 'image/svg+xml' },
      { url: '/favicon-32x32.png', type: 'image/png', sizes: '32x32' },
      { url: '/favicon-16x16.png', type: 'image/png', sizes: '16x16' },
    ],
    shortcut: '/favicon.ico',
    apple: '/apple-touch-icon.png',
  },
  manifest: '/site.webmanifest',
}

export const viewport: Viewport = {
  colorScheme: 'dark',
  themeColor: '#0c1116',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} bg-background`}
      suppressHydrationWarning
    >
      <head>
        {/* 11.3 privacy-friendly analytics (Plausible, cookieless, documented on /privacy). */}
        <script defer data-domain={new URL(siteUrl).hostname} src="https://plausible.io/js/script.js" />
        <style>{`
          #initial-loader {
            position: fixed;
            inset: 0;
            z-index: 9999;
            display: flex;
            align-items: center;
            justify-content: center;
            background: #0c1116;
            transition: opacity 0.3s ease, visibility 0.3s ease;
          }
          #initial-loader.hidden {
            opacity: 0;
            visibility: hidden;
            pointer-events: none;
          }
          .loader-spinner {
            width: 40px;
            height: 40px;
            border: 3px solid #282828;
            border-top-color: #34d399;
            border-radius: 50%;
            animation: spin 0.8s linear infinite;
          }
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
          .loader-text {
            margin-top: 16px;
            font: 13px 'JetBrains Mono', monospace;
            color: #888;
          }
        `}</style>
      </head>
      <body className="font-sans antialiased">
        <div id="initial-loader" suppressHydrationWarning>
          <div className="loader-spinner" />
          <div className="loader-text">Loading CodeAtlas…</div>
        </div>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                // NOTE: hide only — never remove() this node. It is part of
                // React's hydrated tree; removing it races hydration and
                // throws insertBefore/removeChild NotFoundError.
                var loader = document.getElementById('initial-loader');
                if (loader) {
                  var hide = function() {
                    loader.classList.add('hidden');
                  };
                  if (document.readyState === 'complete') {
                    hide();
                  } else {
                    window.addEventListener('load', hide);
                  }
                }
              })();
            `}
          }
        />
        {children}
        <Toaster richColors theme="dark" position="bottom-right" />
      </body>
    </html>
  )
}
