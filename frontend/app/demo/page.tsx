import { DemoPageClient } from "./DemoContent"

export const metadata = {
  title: 'Demo — Watch CodeAtlas analyze a real repo, no signup',
  description:
    'Watch CodeAtlas analyze the FastAPI repository live with honest staged progress, then explore the interactive graph, AI chat, and security scan. No signup; repeat visits reuse the cached analysis.',
  openGraph: {
    title: 'Demo — Watch CodeAtlas analyze a real repo, no signup',
    description:
      'Watch CodeAtlas analyze the FastAPI repository live with honest staged progress, then explore the interactive graph, AI chat, and security scan. No signup; repeat visits reuse the cached analysis.',
    images: ['/og-demo.png'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Demo — Watch CodeAtlas analyze a real repo, no signup',
    description:
      'Watch CodeAtlas analyze the FastAPI repository live with honest staged progress, then explore the interactive graph, AI chat, and security scan. No signup; repeat visits reuse the cached analysis.',
    images: ['/og-demo.png'],
  },
}

export default function DemoPage() {
  return <DemoPageClient />
}