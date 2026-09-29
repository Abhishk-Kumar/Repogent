"use client"

import { useState } from "react"
import { AnimatePresence } from "motion/react"
import { useRouter } from "next/navigation"
import { SiteHeader } from "@/components/site-header"
import { Hero } from "@/components/hero"
import { StatsStrip } from "@/components/stats-strip"
import { HowItWorks } from "@/components/how-it-works"
import { Features } from "@/components/features"
import { LivePreview } from "@/components/live-preview"
import { SiteFooter } from "@/components/site-footer"
import { ProcessingScreen } from "@/components/processing-screen"
import { ParticleBackground } from "@/components/codeatlas/particle-bg"
import { CodeAtlasProvider } from "@/lib/codeatlas/context"

export function HomeContent() {
  const [repo, setRepo] = useState<string | null>(null)
  const router = useRouter()

  const handleComplete = (repoUrl: string) => {
    const short = repoUrl.replace(/^https?:\/\/github\.com\//, "")
    setRepo(null)
    router.push(`/workspace?repo=${encodeURIComponent(short)}`)
  }

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'SoftwareApplication',
        name: 'CodeAtlas',
        url: process.env.NEXT_PUBLIC_SITE_URL || 'https://repogent.onrender.com',
        applicationCategory: 'DeveloperApplication',
        operatingSystem: 'Web',
        offers: {
          '@type': 'Offer',
          price: '0',
          priceCurrency: 'USD',
          availability: 'https://schema.org/InStock',
        },
        description:
          'CodeAtlas is an AI-powered codebase onboarding agent. Paste a GitHub repo or upload a zip to get an interactive dependency graph, AI chat, security scans, and a plain-English explanation of what the code does.',
      },
      {
        '@type': 'FAQPage',
        mainEntity: [
          {
            '@type': 'Question',
            name: 'Is my code sent to third-party AI providers?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'Yes, for AI chat and scan analysis we use LLMs via our backend. Repository code is not stored by providers.',
            },
          },
          {
            '@type': 'Question',
            name: 'Can I use CodeAtlas on private repositories?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'Private repo support is coming soon (Pro tier). During beta, only public repos are supported.',
            },
          },
          {
            '@type': 'Question',
            name: 'How accurate is the dependency graph?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'We use Tree-sitter parsers for static analysis. Dynamic imports, eval, and runtime-only dependencies may not be resolved. The diagnostics banner shows unresolved import count.',
            },
          },
          {
            '@type': 'Question',
            name: "What's the difference between the demo and onboarding my own repo?",
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'The demo analyzes the public fastapi/fastapi repo live with staged progress — no signup. Repeat visits reuse the cached analysis and load instantly. Your own repo takes 30–90s to analyze on first visit.',
            },
          },
          {
            '@type': 'Question',
            name: 'How do I request a new language or feature?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'Email FILL-ME-CONTACT-EMAIL or open an issue on GitHub.',
            },
          },
        ],
      },
    ],
  }

  return (
    <CodeAtlasProvider>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <ParticleBackground />
      <main className="relative z-10 min-h-screen">
        <SiteHeader />
        <Hero onOnboard={setRepo} />
        <StatsStrip />
        <HowItWorks />
        <Features />
        <LivePreview />
        <SiteFooter onOnboard={setRepo} />

        <AnimatePresence>
          {repo && (
            <ProcessingScreen
              repo={repo}
              onClose={() => setRepo(null)}
              onComplete={handleComplete}
            />
          )}
        </AnimatePresence>
      </main>
    </CodeAtlasProvider>
  )
}