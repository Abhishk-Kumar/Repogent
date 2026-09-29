import { DocsPageClient } from "./DocsContent"

export const metadata = {
  title: 'Documentation — Learn how to use CodeAtlas effectively',
  description:
    'Complete documentation for CodeAtlas: quickstart, supported languages, dependency graph, AI chat, security scan, ticket queue, Slack integration, MCP server, API reference, data retention, and FAQ.',
  openGraph: {
    title: 'Documentation — Learn how to use CodeAtlas effectively',
    description:
      'Complete documentation for CodeAtlas: quickstart, supported languages, dependency graph, AI chat, security scan, ticket queue, Slack integration, MCP server, API reference, data retention, and FAQ.',
    images: ['/og-docs.png'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Documentation — Learn how to use CodeAtlas effectively',
    description:
      'Complete documentation for CodeAtlas: quickstart, supported languages, dependency graph, AI chat, security scan, ticket queue, Slack integration, MCP server, API reference, data retention, and FAQ.',
    images: ['/og-docs.png'],
  },
}

export default function DocsPage() {
  return <DocsPageClient activeHref="/docs" />
}