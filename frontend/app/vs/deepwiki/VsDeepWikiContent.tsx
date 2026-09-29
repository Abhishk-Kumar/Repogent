"use client"

import { Check, X, Minus, ExternalLink, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"
import { motion } from "motion/react"
import { ParticleBackground } from "@/components/codeatlas/particle-bg"

type Winner = "codeatlas" | "tie" | "deepwiki"

const COMPARISON: { category: string; items: { feature: string; codeatlas: string; deepwiki: string; winner: Winner }[] }[] = [
  {
    category: "Core Approach",
    items: [
      {
        feature: "Primary technique",
        codeatlas: "Tree-sitter static analysis + LLM augmentation",
        deepwiki: "LLM-only (RAG on repo contents)",
        winner: "codeatlas",
      },
      {
        feature: "Graph accuracy",
        codeatlas: "Deterministic, verifiable edges",
        deepwiki: "Probabilistic, may hallucinate connections",
        winner: "codeatlas",
      },
      {
        feature: "Update mechanism",
        codeatlas: "Incremental re-parse on change",
        deepwiki: "Full re-embed on change",
        winner: "codeatlas",
      },
      {
        feature: "Scalability",
        codeatlas: "O(files) parse time",
        deepwiki: "O(tokens) embedding cost",
        winner: "codeatlas",
      },
    ],
  },
  {
    category: "Features",
    items: [
      {
        feature: "Interactive dependency graph",
        codeatlas: "Pan, zoom, click for file details (functions, classes, purpose)",
        deepwiki: "Static wiki pages, no graph",
        winner: "codeatlas",
      },
      {
        feature: "Security scan",
        codeatlas: "SQLi, XSS, secrets, crypto, path traversal + code quality",
        deepwiki: "Not available",
        winner: "codeatlas",
      },
      {
        feature: "AI chat",
        codeatlas: "Grounded in graph + file contents",
        deepwiki: "RAG-based, grounded in embedded chunks",
        winner: "tie",
      },
      {
        feature: "Ticket integration (Jira/Linear)",
        codeatlas: "Per-finding + bulk create via OAuth",
        deepwiki: "Not available",
        winner: "codeatlas",
      },
      {
        feature: "Slack integration",
        codeatlas: "Block Kit share + notify-on-complete + webhook fallback",
        deepwiki: "Not available",
        winner: "codeatlas",
      },
      {
        feature: "MCP server (agent access)",
        codeatlas: "Graph, scan, chat as tools for Cursor/Claude Code/Copilot",
        deepwiki: "Not available",
        winner: "codeatlas",
      },
      {
        feature: "Private repos",
        codeatlas: "Coming soon (Pro tier)",
        deepwiki: "Supported",
        winner: "deepwiki",
      },
    ],
  },
  {
    category: "Privacy & Data",
    items: [
      {
        feature: "Source code storage",
        codeatlas: "Never stored — deleted after analysis",
        deepwiki: "Embedded in vector DB (configurable retention)",
        winner: "codeatlas",
      },
      {
        feature: "Zero-retention mode",
        codeatlas: "Delete all artifacts on session end",
        deepwiki: "Not available",
        winner: "codeatlas",
      },
      {
        feature: "Token storage",
        codeatlas: "Encrypted at rest, never in localStorage/logs",
        deepwiki: "OAuth tokens stored per their policy",
        winner: "codeatlas",
      },
    ],
  },
  {
    category: "Developer Experience",
    items: [
      {
        feature: "Onboarding speed",
        codeatlas: "30–90s (clone + parse + graph)",
        deepwiki: "Depends on repo size, embedding time",
        winner: "codeatlas",
      },
      {
        feature: "Demo / trial",
        codeatlas: "Live /demo analyzing a real repo, no signup",
        deepwiki: "Requires signup + repo connect",
        winner: "codeatlas",
      },
      {
        feature: "Export formats",
        codeatlas: "JSON, CSV, TXT, PDF (print)",
        deepwiki: "Markdown wiki pages",
        winner: "codeatlas",
      },
      {
        feature: "Pricing transparency",
        codeatlas: "Free in beta, Pro/Team = coming soon (no fake pricing)",
        deepwiki: "Public pricing tiers",
        winner: "tie",
      },
    ],
  },
]

function VerdictIcon({ winner }: { winner: "codeatlas" | "deepwiki" | "tie" }) {
  switch (winner) {
    case "codeatlas":
      return <Check className="size-5 text-emerald-500" />
    case "deepwiki":
      return <Check className="size-5 text-blue-500" />
    case "tie":
      return <Minus className="size-5 text-amber-500" />
  }
}

function VerdictLabel({ winner }: { winner: "codeatlas" | "deepwiki" | "tie" }) {
  switch (winner) {
    case "codeatlas":
      return <span className="text-emerald-500 font-medium">CodeAtlas</span>
    case "deepwiki":
      return <span className="text-blue-500 font-medium">DeepWiki</span>
    case "tie":
      return <span className="text-amber-500 font-medium">Tie</span>
  }
}

export function VsDeepWikiContent() {
  return (
    <>
      <SiteHeader />
      <main className="relative min-h-screen">
        <ParticleBackground className="pointer-events-none absolute inset-0 h-full w-full opacity-70" />
        <div className="relative mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:py-28">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="text-center mb-12"
          >
            <h1 className="text-balance text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl">
              CodeAtlas vs DeepWiki
            </h1>
            <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
              An honest comparison for engineers. We think CodeAtlas wins for structural
              understanding — but DeepWiki has its place. Here's the breakdown.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1, ease: "easeOut" }}
            className="space-y-12"
          >
            {COMPARISON.map((section, sectionIndex) => (
              <motion.section
                key={section.category}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.15 + sectionIndex * 0.08, ease: "easeOut" }}
              >
                <h2 className="text-2xl font-semibold mb-6">{section.category}</h2>
                <div className="overflow-x-auto rounded-xl border border-border">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border bg-muted/50">
                        <th className="py-3 px-4 text-left text-sm font-medium text-foreground">Feature</th>
                        <th className="py-3 px-4 text-left text-sm font-medium text-foreground">CodeAtlas</th>
                        <th className="py-3 px-4 text-left text-sm font-medium text-foreground">DeepWiki</th>
                        <th className="py-3 px-4 text-center text-sm font-medium text-foreground">Winner</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                      {section.items.map((item) => (
                        <tr key={item.feature} className="hover:bg-secondary/30">
                          <td className="py-3 px-4 font-medium text-foreground">{item.feature}</td>
                          <td className="py-3 px-4 text-sm text-muted-foreground max-w-md">{item.codeatlas}</td>
                          <td className="py-3 px-4 text-sm text-muted-foreground max-w-md">{item.deepwiki}</td>
                          <td className="py-3 px-4 text-center flex items-center justify-center gap-2">
                            <VerdictIcon winner={item.winner} />
                            <VerdictLabel winner={item.winner} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </motion.section>
            ))}

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.5, ease: "easeOut" }}
              className="rounded-2xl border border-border bg-card/50 p-6"
            >
              <h3 className="text-xl font-semibold mb-4">The honest take</h3>
              <div className="prose prose-invert max-w-none space-y-4">
                <p>
                  <strong>Use CodeAtlas when:</strong> you need a trustworthy dependency graph for
                  architecture reviews, onboarding, impact analysis, or agent integration (MCP).
                  You want deterministic answers — "what calls this function?" returns the same
                  list every time.
                </p>
                <p>
                  <strong>Use DeepWiki when:</strong> you want narrative documentation (wiki-style
                  pages generated from code), need private repo support today, or have non-technical
                  stakeholders who prefer reading over exploring a graph.
                </p>
                <p>
                  <strong>Use both:</strong> CodeAtlas for structural truth (graph, scan, MCP
                  tools). DeepWiki for the narrative layer (READMEs, onboarding guides). They're
                  complementary, not competitive.
                </p>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.6, ease: "easeOut" }}
              className="flex flex-col sm:flex-row items-center justify-center gap-4"
            >
              <Button
                onClick={() => window.location.href = "/demo"}
                size="lg"
                className="group"
              >
                Try CodeAtlas Free
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
              </Button>
              <a
                href="https://deepwiki.com"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-lg border border-border bg-card/50 px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:border-primary/40 hover:bg-card"
              >
                View DeepWiki
                <ExternalLink className="size-4" />
              </a>
            </motion.div>
          </motion.div>
        </div>
        <SiteFooter onOnboard={() => window.location.href = "/#top"} />
      </main>
    </>
  )
}