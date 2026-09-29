"use client"

import Link from "next/link"
import { ArrowRight, Calendar, Clock, ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"
import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"
import { motion } from "motion/react"
import { ParticleBackground } from "@/components/codeatlas/particle-bg"

const POSTS = [
  {
    slug: "dependency-graph-import-resolution",
    title: "How Our Dependency Graph Resolves Imports",
    description: "A deep dive into Tree-sitter parsing, import resolution, and handling edge cases like dynamic imports and re-exports.",
    date: "2025-01-15",
    readTime: "8 min",
    tags: ["Engineering", "Graph", "Tree-sitter"],
  },
  {
    slug: "codeatlas-vs-deepwiki",
    title: "CodeAtlas vs DeepWiki: An Honest Comparison",
    description: "We compare approaches: static analysis vs LLM-only, interactive graph vs wiki pages, and when each shines.",
    date: "2025-01-20",
    readTime: "6 min",
    tags: ["Product", "Comparison", "AI"],
  },
  {
    slug: "changelog-ticket-system-slack",
    title: "Changelog: Ticket System + Slack Integration",
    description: "New in v0.4: per-finding Jira/Linear tickets, bulk create, Slack sharing with Block Kit, and notify-on-complete.",
    date: "2025-01-25",
    readTime: "4 min",
    tags: ["Release", "Integrations", "Slack", "Jira"],
  },
  {
    slug: "how-codeatlas-works",
    title: "How CodeAtlas Works: From Clone to Agent Infrastructure",
    description: "The full pipeline: Tree-sitter import resolution, context-aware scoring, ticket/Slack integrations, and the MCP server that turns analysis into agent tools.",
    date: "2025-01-28",
    readTime: "10 min",
    tags: ["Engineering", "Architecture", "MCP"],
  },
]

function PostCard({ post }: { post: typeof POSTS[0] }) {
  return (
    <motion.article
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="group flex flex-col rounded-2xl border border-border bg-card/70 p-6 shadow-lg shadow-black/20 backdrop-blur transition-colors hover:border-primary/30"
    >
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground mb-3">
        <span className="flex items-center gap-1">
          <Calendar className="size-3" />
          {post.date}
        </span>
        <span className="flex items-center gap-1">
          <Clock className="size-3" />
          {post.readTime}
        </span>
      </div>
      <h2 className="text-xl font-semibold mb-2 group-hover:text-primary transition-colors">
        {post.title}
      </h2>
      <p className="text-muted-foreground mb-4 flex-1">{post.description}</p>
      <div className="flex flex-wrap gap-2 mb-4">
        {post.tags.map((tag) => (
          <span
            key={tag}
            className="rounded-full border border-border bg-secondary/50 px-2 py-0.5 text-xs text-muted-foreground"
          >
            {tag}
          </span>
        ))}
      </div>
      <Link
        href={`/blog/${post.slug}`}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
      >
        Read more
        <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
      </Link>
    </motion.article>
  )
}

export function BlogIndexContent() {
  return (
    <>
      <SiteHeader />
      <main className="relative min-h-screen">
        <ParticleBackground className="pointer-events-none absolute inset-0 h-full w-full opacity-70" />
        <div className="relative mx-auto max-w-4xl px-4 py-20 sm:px-6 lg:py-28">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="text-center mb-16"
          >
            <h1 className="text-balance text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl">
              CodeAtlas Blog
            </h1>
            <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
              Engineering notes, product updates, and honest comparisons. No marketing fluff.
            </p>
          </motion.div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {POSTS.map((post, i) => (
              <PostCard key={post.slug} post={post} />
            ))}
          </div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3, ease: "easeOut" }}
            className="mt-16 text-center"
          >
            <Button variant="outline" size="lg" onClick={() => window.location.href = "/changelog"}>
              View Changelog
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </Button>
          </motion.div>
        </div>
        <SiteFooter onOnboard={() => window.location.href = "/#top"} />
      </main>
    </>
  )
}