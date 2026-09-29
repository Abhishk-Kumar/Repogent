import { DocsPageClient } from "../DocsContent"
import { generateStaticParams } from "./generate-static-params"

const DOC_TITLES: Record<string, string> = {
  quickstart: 'Quickstart',
  languages: 'Supported Languages',
  limits: 'Repository Limits',
  graph: 'Dependency Graph',
  chat: 'AI Chat',
  scan: 'Security Scan',
  tickets: 'Ticket Queue',
  slack: 'Slack Integration',
  mcp: 'MCP Server',
  'connect-agent': 'Connect Your Agent',
  api: 'API Reference',
  webhooks: 'Webhooks',
  'data-retention': 'Data Retention',
  'zero-retention': 'Zero-Retention Mode',
  faq: 'FAQ',
}

const DOC_DESCRIPTIONS: Record<string, string> = {
  quickstart: 'Onboard your first repository in under 60 seconds.',
  languages: 'CodeAtlas parses and builds dependency graphs for Python, JavaScript, TypeScript, Go, Rust, Java, C#, and more.',
  limits: 'Current limits during beta: 500MB repo size, 10k files parsed, 5k graph nodes, 7-day session TTL.',
  graph: 'Interactive visualization of your codebase structure with pan, zoom, click nodes for file details.',
  chat: 'Ask questions about your codebase in natural language — answers grounded in the dependency graph and file contents.',
  scan: 'Automated vulnerability and code quality analysis: SQLi, XSS, secrets, crypto, path traversal, N+1 queries, dead code.',
  tickets: 'Create and push tickets to Jira or Linear from scan findings. Per-finding and bulk create with OAuth.',
  slack: 'Share scan summaries to Slack with Block Kit formatting. Webhook fallback and notify-on-complete opt-in.',
  mcp: 'Let AI agents (Cursor, Claude Code, Copilot) query your analyzed repository via Model Context Protocol.',
  'connect-agent': 'Add CodeAtlas as an MCP server to Cursor, Claude Code, OpenCode, or any MCP-compatible agent.',
  api: 'REST endpoints for programmatic access: graph, scan, chat, explain, tickets, Jira push, tech stack.',
  webhooks: 'Receive events from CodeAtlas (scan.completed, chat.question). HMAC-SHA256 signed payloads.',
  'data-retention': 'How long we keep your code and analysis data. Repository code deleted immediately after analysis.',
  'zero-retention': 'Delete all analysis data immediately after your session ends. Recommended for sensitive codebases.',
  faq: 'Frequently asked questions about CodeAtlas: AI providers, private repos, graph accuracy, demo vs onboard, feature requests.',
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const resolvedParams = await params
  const slug = resolvedParams.slug
  const title = DOC_TITLES[slug] || 'Documentation'
  const description = DOC_DESCRIPTIONS[slug] || 'Learn how to use CodeAtlas effectively.'

  return {
    title: `${title} — CodeAtlas Docs`,
    description,
    openGraph: {
      title: `${title} — CodeAtlas Docs`,
      description,
      images: ['/og-docs.png'],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${title} — CodeAtlas Docs`,
      description,
      images: ['/og-docs.png'],
    },
  }
}

export default async function DocsSlugPage({ params }: { params: Promise<{ slug: string }> }) {
  const resolvedParams = await params
  const slug = `/docs/${resolvedParams.slug}`

  return <DocsPageClient activeHref={slug} />
}

export { generateStaticParams }