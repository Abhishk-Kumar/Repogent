import { HomeContent } from "./HomeContent"

export const metadata = {
  title: 'CodeAtlas — Understand any codebase in minutes, not weeks',
  description:
    'CodeAtlas is an AI-powered codebase onboarding agent. Paste a GitHub repo or upload a zip to get an interactive dependency graph, AI chat, security scans, and a plain-English explanation of what the code does.',
  openGraph: {
    title: 'CodeAtlas — Understand any codebase in minutes, not weeks',
    description:
      'CodeAtlas is an AI-powered codebase onboarding agent. Paste a GitHub repo or upload a zip to get an interactive dependency graph, AI chat, security scans, and a plain-English explanation of what the code does.',
    images: ['/og-default.png'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'CodeAtlas — Understand any codebase in minutes, not weeks',
    description:
      'CodeAtlas is an AI-powered codebase onboarding agent. Paste a GitHub repo or upload a zip to get an interactive dependency graph, AI chat, security scans, and a plain-English explanation of what the code does.',
    images: ['/og-default.png'],
  },
}

export default function Page() {
  return <HomeContent />
}