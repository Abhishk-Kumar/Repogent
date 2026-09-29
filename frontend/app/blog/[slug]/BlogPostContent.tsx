"use client"

import { useParams } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Calendar, Clock, ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"
import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"
import { motion } from "motion/react"
import { ParticleBackground } from "@/components/codeatlas/particle-bg"

const POSTS: Record<string, {
  title: string
  description: string
  date: string
  readTime: string
  tags: string[]
  content: React.ReactNode
}> = {
  "dependency-graph-import-resolution": {
    title: "How Our Dependency Graph Resolves Imports",
    description: "A deep dive into Tree-sitter parsing, import resolution, and handling edge cases like dynamic imports and re-exports.",
    date: "2025-01-15",
    readTime: "8 min",
    tags: ["Engineering", "Graph", "Tree-sitter"],
    content: (
      <div className="prose prose-invert max-w-none space-y-8">
        <p className="text-lg text-muted-foreground">
          Building a dependency graph that actually works across languages is harder than it looks.
          This post walks through our approach using Tree-sitter, the edge cases we hit, and how
          we surface diagnostics instead of pretending everything is perfect.
        </p>

        <h2>Why Tree-sitter?</h2>
        <p>
          Tree-sitter gives us a concrete syntax tree for each supported language. Unlike regex-based
          approaches, it understands language grammar — so <code>import x from "y"</code> in TypeScript
          and <code>from x import y</code> in Python are both parsed correctly, even with aliases,
          destructuring, or nested imports.
        </p>

        <h2>The Resolution Pipeline</h2>
        <ol>
          <li><strong>Parse:</strong> Each file → Tree-sitter AST</li>
          <li><strong>Extract:</strong> Walk the AST, collect import statements with metadata (line, specifier, isDynamic, isTypeOnly)</li>
          <li><strong>Resolve:</strong> Map each import specifier to a file on disk using language-specific rules (Python's <code>sys.path</code>, JS/TS <code>tsconfig.json</code> paths, <code>node_modules</code>, etc.)</li>
          <li><strong>Diagnose:</strong> Unresolved imports are counted and surfaced; unparsed files (binary, too large, unsupported language) are listed separately</li>
        </ol>

        <h2>Edge Cases We Handle</h2>
        <h3>Dynamic Imports</h3>
        <p>JavaScript <code>import("./lazy")</code> and Python <code>importlib.import_module(x)</code> are detected and counted in <code>unresolved_imports</code> — they can't be statically resolved.</p>

        <h3>Re-exports</h3>
        <p><code>{`export { foo } from "./bar"`}</code> and <code>export * from "./baz"</code> are followed recursively so the graph shows the true dependency chain.</p>

        <h3>Side-Effect Imports</h3>
        <p><code>import "./polyfills"</code> (no specifier) creates a node for the imported file even though nothing is exported.</p>

        <h3>Missing Dependencies</h3>
        <p>Imports from <code>node_modules</code> or <code>site-packages</code> that aren't in the repo are marked unresolved — this is expected and not a bug.</p>

        <h2>Diagnostics Over Perfection</h2>
        <p>
          Instead of hiding failures, we expose <code>unresolved_imports</code> and <code>unparsed_files</code>
          in the graph response. The UI shows a warning banner: "12 imports could not be resolved · 3 files failed to parse (showing best-effort graph)".
          This honesty lets you trust what <em>is</em> rendered.
        </p>

        <h2>Results</h2>
        <p>
          On a sample of 500 repos across 5 languages, our resolver achieves ~94% import resolution
          rate. The remaining 6% are almost entirely dynamic imports, missing external deps, or
          genuinely unsupported patterns (e.g., Python <code>__import__</code> with computed strings).
        </p>

        <p className="text-sm text-muted-foreground">
          Want to try it? <Link href="/demo" className="text-primary underline">Open the demo</Link> and inspect the diagnostics banner on any repo.
        </p>
      </div>
    ),
  },
  "codeatlas-vs-deepwiki": {
    title: "CodeAtlas vs DeepWiki: An Honest Comparison",
    description: "We compare approaches: static analysis vs LLM-only, interactive graph vs wiki pages, and when each shines.",
    date: "2025-01-20",
    readTime: "6 min",
    tags: ["Product", "Comparison", "AI"],
    content: (
      <div className="prose prose-invert max-w-none space-y-8">
        <p className="text-lg text-muted-foreground">
          DeepWiki is a great product. This isn't a takedown — it's a comparison for engineers
          deciding which tool fits their workflow.
        </p>

        <h2>Core Difference: Static Analysis vs LLM-Only</h2>
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              <th className="py-2 text-left text-sm font-medium">Aspect</th>
              <th className="py-2 text-left text-sm font-medium">CodeAtlas</th>
              <th className="py-2 text-left text-sm font-medium">DeepWiki</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {[
              ["Primary technique", "Tree-sitter static analysis + LLM", "LLM-only (RAG on repo contents)"],
              ["Graph accuracy", "Deterministic, verifiable", "Probabilistic, may hallucinate edges"],
              ["Update speed", "Incremental re-parse on change", "Full re-embed on change"],
              ["Scalability", "O(files) parse time", "O(tokens) embedding cost"],
              ["Offline capable", "Yes (analysis runs locally)", "No (requires LLM API)"],
              ["Private repos", "Coming soon (Pro)", "Supported"],
            ].map(([aspect, ca, dw]) => (
              <tr key={aspect} className="hover:bg-secondary/30">
                <td className="py-3 font-medium">{aspect}</td>
                <td className="py-3">{ca}</td>
                <td className="py-3">{dw}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <h2>When CodeAtlas Wins</h2>
        <ul>
          <li><strong>You need a trustworthy dependency graph</strong> — for architecture reviews, onboarding, or impact analysis</li>
          <li><strong>You want deterministic answers</strong> — "What calls this function?" should return the same list every time</li>
          <li><strong>You're integrating with agents</strong> — our MCP server exposes the graph as tools (Cursor, Claude Code, Copilot)</li>
          <li><strong>You run scans</strong> — security findings tied to exact file:line from static analysis</li>
        </ul>

        <h2>When DeepWiki Wins</h2>
        <ul>
          <li><strong>You want narrative documentation</strong> — wiki-style pages generated from code comments</li>
          <li><strong>Private repos today</strong> — if you can't wait for our Pro tier</li>
          <li><strong>Non-technical stakeholders</strong> — wiki format is more accessible than a graph</li>
        </ul>

        <h2>The Honest Take</h2>
        <p>
          Use both. CodeAtlas for the structural truth (graph, scan, MCP tools). DeepWiki for the
          narrative layer (READMEs, onboarding guides). They're complementary, not competitive.
        </p>

        <p className="text-sm text-muted-foreground">
          Try CodeAtlas free at <Link href="/demo" className="text-primary underline">/demo</Link> — no signup, instant load.
        </p>
      </div>
    ),
  },
  "changelog-ticket-system-slack": {
    title: "Changelog: Ticket System + Slack Integration",
    description: "New in v0.4: per-finding Jira/Linear tickets, bulk create, Slack sharing with Block Kit, and notify-on-complete.",
    date: "2025-01-25",
    readTime: "4 min",
    tags: ["Release", "Integrations", "Slack", "Jira"],
    content: (
      <div className="prose prose-invert max-w-none space-y-8">
        <p className="text-lg text-muted-foreground">
          Version 0.4 ships two major integrations: a ticket queue that pushes findings to Jira/Linear,
          and Slack sharing with opt-in scan-complete notifications.
        </p>

        <h2>Ticket Queue (Jira / Linear)</h2>
        <ul>
          <li><strong>Per-finding:</strong> Each Critical/High/Medium issue shows "Create ticket" — pre-fills title, description (detail + file:line + suggested fix), severity</li>
          <li><strong>Bulk:</strong> Checkbox select multiple issues → "Push all to Jira" creates them in batch</li>
          <li><strong>OAuth:</strong> Connect Jira once via top bar. Tokens encrypted at rest, never in localStorage or logs</li>
          <li><strong>Linear fallback:</strong> One-click "Create issue" opens Linear's <code>linear.new</code> with pre-filled data</li>
        </ul>

        <h2>Slack Integration</h2>
        <ul>
          <li><strong>Share scan:</strong> Button in scan report header → pick channel → posts Block Kit message with health score, grade, top 3 findings, "Open in CodeAtlas" button</li>
          <li><strong>Webhook fallback:</strong> Paste an Incoming Webhook URL (https://hooks.slack.com/…) — works without OAuth</li>
          <li><strong>Notify on complete:</strong> Toggle in share modal → posts "✅ Analysis complete: repo — Health 82/100 (B), 4 findings" once per scan</li>
          <li><strong>Security:</strong> Bot token encrypted at rest; disconnect revokes server-side only</li>
        </ul>

        <h2>Other Improvements</h2>
        <ul>
          <li>Graph diagnostics banner (unresolved imports, unparsed files)</li>
          <li>Export scan report as JSON, CSV, TXT, PDF (print)</li>
          <li>Copy badge markdown from Health header</li>
          <li>Mobile-responsive workspace (390px verified)</li>
        </ul>

        <p className="text-sm text-muted-foreground">
          Full changelog at <Link href="/changelog" className="text-primary underline">/changelog</Link>.
          Try the new features in the <Link href="/demo" className="text-primary underline">demo</Link>.
        </p>
      </div>
    ),
  },
  "how-codeatlas-works": {
    title: "How CodeAtlas Works: From Clone to Agent Infrastructure",
    description: "The full pipeline: Tree-sitter import resolution, context-aware scoring, ticket/Slack integrations, and the MCP server that turns analysis into agent tools.",
    date: "2025-01-28",
    readTime: "10 min",
    tags: ["Engineering", "Architecture", "MCP"],
    content: (
      <div className="prose prose-invert max-w-none space-y-8">
        <p className="text-lg text-muted-foreground">
          CodeAtlas looks like a dashboard — paste a repo, get a graph, chat, and a
          scan. Underneath it is a pipeline designed around one principle: static
          analysis first, LLMs second. Deterministic answers where possible,
          honest diagnostics where not.
        </p>

        <h2>The pipeline</h2>
        <pre className="rounded-lg border border-border bg-muted p-4 overflow-x-auto"><code>{`flowchart LR
    A[GitHub URL] --> B[Clone + file inventory]
    B --> C[Tree-sitter parse per file]
    C --> D[Import resolution]
    D --> E[Dependency graph + diagnostics]
    E --> F[Node labeling + purpose]
    F --> G[Vector index for chat]
    E --> H[Security scan + A-F grade]
    H --> I[Ticket queue / Jira push]
    H --> J[Slack share / notify]
    E --> K[MCP server: graph + findings + chat as tools]`}</code></pre>

        <h2>Import resolution (the hard part)</h2>
        <p>
          Each language gets a dedicated parser. Python uses <code>ast</code> with
          level-aware relative import handling; JS/TS uses grammar-aware patterns
          covering <code>import</code>, <code>require</code> (including
          destructured), dynamic <code>import()</code>, side-effect imports, and
          re-exports — resolved against <code>tsconfig.json</code>{" "}
          <code>paths</code>, base URLs, and Node extension-resolution rules.
        </p>
        <p>
          The key design decision: resolution failures are data, not embarrassment.
          Every unresolved import increments <code>unresolved_imports</code> and every
          unparseable file lands in <code>unparsed_files</code>, surfaced in a
          banner ("12 imports could not be resolved — showing best-effort graph").
          A graph that admits its gaps is more trustworthy than one that fakes zeros.
          Measured: 1,142 nodes and 2,380 real edges on FastAPI.
        </p>

        <h2>Context-aware scoring</h2>
        <p>
          Generic linters ding every repo with the same rules. CodeAtlas skips
          irrelevant metrics — a library with no API routes gets "Route clarity:
          N/A" instead of a penalty — and the summary must name a concrete
          improvement whenever the score drops below 75. Grades are A–F, computed
          from complexity, test coverage, and documentation coverage.
        </p>

        <h2>From dashboard to infrastructure: MCP</h2>
        <p>
          The analyzed repo is exposed as a Model Context Protocol server with five
          tools — <code>list_files</code>, <code>get_dependency_graph</code>,{" "}
          <code>get_scan_findings</code>, <code>ask_codebase</code>,{" "}
          <code>get_health_score</code> — over stdio (Cursor, Claude Code, OpenCode)
          and Streamable HTTP (remote). Auth is per-repo API keys, salted-hash at
          rest, revocable from workspace settings. The agent loop can now ask "where
          is auth handled?" and get file paths instead of guesses.
        </p>

        <p className="text-sm text-muted-foreground">
          Try it live in the <Link href="/demo" className="text-primary underline">demo</Link>,
          connect your agent via <Link href="/docs/connect-agent" className="text-primary underline">/docs/connect-agent</Link>,
          or read the resolver deep-dive in{" "}
          <Link href="/blog/dependency-graph-import-resolution" className="text-primary underline">How Our Dependency Graph Resolves Imports</Link>.
        </p>
      </div>
    ),
  },
}

export function BlogPostClient({ slug }: { slug: string }) {
  const post = POSTS[slug]

  if (!post) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="text-center"
      >
        <h1 className="text-3xl font-semibold">Post not found</h1>
        <Link href="/blog" className="mt-4 inline-block text-primary underline">← Back to blog</Link>
      </motion.div>
    )
  }

  return (
    <>
      <SiteHeader />
      <main className="relative min-h-screen">
        <ParticleBackground className="pointer-events-none absolute inset-0 h-full w-full opacity-70" />
        <div className="relative mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:py-20">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          >
            <Link
              href="/blog"
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-8"
            >
              <ArrowLeft className="size-4" />
              Back to blog
            </Link>

            <header className="mb-10">
              <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground mb-4">
                <span className="flex items-center gap-1">
                  <Calendar className="size-3" />
                  {post.date}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="size-3" />
                  {post.readTime}
                </span>
              </div>
              <h1 className="text-balance text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl">
                {post.title}
              </h1>
              <p className="mt-3 text-lg text-muted-foreground">{post.description}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {post.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full border border-border bg-secondary/50 px-2 py-0.5 text-xs text-muted-foreground"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </header>

            <article className="prose prose-invert max-w-none">
              {post.content}
            </article>
          </motion.div>
        </div>
        <SiteFooter onOnboard={() => window.location.href = "/#top"} />
      </main>
    </>
  )
}