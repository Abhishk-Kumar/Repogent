import { VsDeepWikiContent } from "./VsDeepWikiContent"

export const metadata = {
  title: 'CodeAtlas vs DeepWiki — Honest comparison for engineers',
  description:
    'CodeAtlas vs DeepWiki: static analysis vs LLM-only, interactive graph vs wiki pages, security scan, ticket integrations, MCP server, private repos. When to use each.',
  openGraph: {
    title: 'CodeAtlas vs DeepWiki — Honest comparison for engineers',
    description:
      'CodeAtlas vs DeepWiki: static analysis vs LLM-only, interactive graph vs wiki pages, security scan, ticket integrations, MCP server, private repos. When to use each.',
    images: ['/og-vs-deepwiki.png'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'CodeAtlas vs DeepWiki — Honest comparison for engineers',
    description:
      'CodeAtlas vs DeepWiki: static analysis vs LLM-only, interactive graph vs wiki pages, security scan, ticket integrations, MCP server, private repos. When to use each.',
    images: ['/og-vs-deepwiki.png'],
  },
}

export default function VsDeepWikiPage() {
  return <VsDeepWikiContent />
}