import { BlogPostClient } from "./BlogPostContent"
import { generateStaticParams } from "./generate-static-params"

const POST_META: Record<string, { title: string; description: string }> = {
  'dependency-graph-import-resolution': {
    title: 'How Our Dependency Graph Resolves Imports',
    description: 'A deep dive into Tree-sitter parsing, import resolution, and handling edge cases like dynamic imports and re-exports.',
  },
  'codeatlas-vs-deepwiki': {
    title: 'CodeAtlas vs DeepWiki: An Honest Comparison',
    description: 'We compare approaches: static analysis vs LLM-only, interactive graph vs wiki pages, and when each shines.',
  },
  'changelog-ticket-system-slack': {
    title: 'Changelog: Ticket System + Slack Integration',
    description: 'New in v0.4: per-finding Jira/Linear tickets, bulk create, Slack sharing with Block Kit, and notify-on-complete.',
  },
  'how-codeatlas-works': {
    title: 'How CodeAtlas Works: From Clone to Agent Infrastructure',
    description: 'The full pipeline: Tree-sitter import resolution, context-aware scoring, ticket/Slack integrations, and the MCP server that turns analysis into agent tools.',
  },
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const resolvedParams = await params
  const slug = resolvedParams.slug
  const meta = POST_META[slug] || { title: 'Blog Post', description: 'CodeAtlas blog post' }

  return {
    title: `${meta.title} — CodeAtlas Blog`,
    description: meta.description,
    openGraph: {
      title: `${meta.title} — CodeAtlas Blog`,
      description: meta.description,
      type: 'article',
      publishedTime: '2025-01-15',
      images: ['/og-blog.png'],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${meta.title} — CodeAtlas Blog`,
      description: meta.description,
      images: ['/og-blog.png'],
    },
  }
}

export default async function BlogSlugPage({ params }: { params: Promise<{ slug: string }> }) {
  const resolvedParams = await params
  const slug = resolvedParams.slug

  return <BlogPostClient slug={slug} />
}

export { generateStaticParams }