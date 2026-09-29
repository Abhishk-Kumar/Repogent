"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { ChevronRight, ExternalLink, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"
import { motion, AnimatePresence } from "motion/react"
import { ParticleBackground } from "@/components/codeatlas/particle-bg"
import { cn } from "@/lib/utils"

const DOCS_NAV = [
  {
    title: "Getting Started",
    items: [
      { label: "Quickstart", href: "/docs/quickstart" },
      { label: "Supported Languages", href: "/docs/languages" },
      { label: "Repository Limits", href: "/docs/limits" },
    ],
  },
  {
    title: "Core Features",
    items: [
      { label: "Dependency Graph", href: "/docs/graph" },
      { label: "AI Chat", href: "/docs/chat" },
      { label: "Security Scan", href: "/docs/scan" },
      { label: "Ticket Queue", href: "/docs/tickets" },
      { label: "Slack Integration", href: "/docs/slack" },
    ],
  },
  {
    title: "API & Integrations",
    items: [
      { label: "MCP Server", href: "/docs/mcp" },
      { label: "Connect Your Agent", href: "/docs/connect-agent" },
      { label: "API Reference", href: "/docs/api" },
      { label: "Webhooks", href: "/docs/webhooks" },
    ],
  },
  {
    title: "Privacy & Data",
    items: [
      { label: "Data Retention", href: "/docs/data-retention" },
      { label: "Zero-Retention Mode", href: "/docs/zero-retention" },
      { label: "FAQ", href: "/docs/faq" },
    ],
  },
  {
    title: "More from CodeAtlas",
    items: [
      { label: "Changelog", href: "/changelog" },
      { label: "CodeAtlas vs DeepWiki", href: "/vs/deepwiki" },
      { label: "Privacy Policy", href: "/privacy" },
      { label: "Terms of Service", href: "/terms" },
    ],
  },
]

function DocsSidebar({ activeHref }: { activeHref: string }) {
  return (
    <aside className="hidden lg:block w-64 flex-shrink-0">
      <nav className="sticky top-24 space-y-6 px-4" aria-label="Documentation navigation">
        {DOCS_NAV.map((section, sectionIndex) => (
          <motion.div
            key={section.title}
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, delay: 0.1 + sectionIndex * 0.05, ease: "easeOut" }}
          >
            <h4 className="mb-2 px-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
              {section.title}
            </h4>
            <ul className="space-y-1" role="list">
              {section.items.map((item) => {
                const isActive = activeHref === item.href || activeHref.startsWith(item.href + "/")
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={cn(
                        "flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors",
                        isActive
                          ? "bg-primary/10 text-primary font-medium"
                          : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
                      )}
                      aria-current={isActive ? "page" : undefined}
                    >
                      {item.label}
                      {isActive && <ChevronRight className="size-3.5 ml-auto" />}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </motion.div>
        ))}
      </nav>
    </aside>
  )
}

const DOCS_CONTENT: Record<string, { title: string; description: string; content: React.ReactNode }> = {
  "/docs": {
    title: "Documentation",
    description: "Learn how to use CodeAtlas effectively — from onboarding your first repo to integrating with your workflow.",
    content: (
      <div className="space-y-12">
        <section>
          <h2 className="text-2xl font-semibold">Getting Started</h2>
          <p className="mt-2 text-muted-foreground">New to CodeAtlas? Start here.</p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {DOCS_NAV[0].items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="group rounded-xl border border-border bg-card/50 p-5 transition-colors hover:border-primary/40 hover:bg-card"
              >
                <h3 className="font-semibold text-foreground group-hover:text-primary">{item.label}</h3>
              </Link>
            ))}
          </div>
        </section>
        <section>
          <h2 className="text-2xl font-semibold">Core Features</h2>
          <p className="mt-2 text-muted-foreground">Deep-dive guides for each feature.</p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {DOCS_NAV[1].items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="group rounded-xl border border-border bg-card/50 p-5 transition-colors hover:border-primary/40 hover:bg-card"
              >
                <h3 className="font-semibold text-foreground group-hover:text-primary">{item.label}</h3>
              </Link>
            ))}
          </div>
        </section>
        <section>
          <h2 className="text-2xl font-semibold">API & Integrations</h2>
          <p className="mt-2 text-muted-foreground">Extend CodeAtlas with MCP and webhooks.</p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {DOCS_NAV[2].items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="group rounded-xl border border-border bg-card/50 p-5 transition-colors hover:border-primary/40 hover:bg-card"
              >
                <h3 className="font-semibold text-foreground group-hover:text-primary">{item.label}</h3>
              </Link>
            ))}
          </div>
        </section>
        <section>
          <h2 className="text-2xl font-semibold">Privacy & Data</h2>
          <p className="mt-2 text-muted-foreground">How we handle your code and data.</p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {DOCS_NAV[3].items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="group rounded-xl border border-border bg-card/50 p-5 transition-colors hover:border-primary/40 hover:bg-card"
              >
                <h3 className="font-semibold text-foreground group-hover:text-primary">{item.label}</h3>
              </Link>
            ))}
          </div>
        </section>
      </div>
    ),
  },
  "/docs/quickstart": {
    title: "Quickstart",
    description: "Onboard your first repository in under 60 seconds.",
    content: (
      <div className="prose prose-invert max-w-none space-y-8">
        <p className="text-lg text-muted-foreground">
          CodeAtlas analyzes any GitHub repository and gives you an interactive dependency
          graph, an AI that answers questions about the codebase, and an automated security
          scan — all in one session.
        </p>
        <h3>1. Paste a repository URL</h3>
        <p>Go to the homepage and enter a GitHub URL (e.g. <code>github.com/vercel/next.js</code>) or <code>owner/repo</code> format.</p>
        <h3>2. Wait for analysis</h3>
        <p>Cloning, parsing, and graph building typically takes 30–90 seconds depending on repo size.</p>
        <h3>3. Explore</h3>
        <ul>
          <li><strong>Graph:</strong> Pan, zoom, click nodes to see file details and dependencies</li>
          <li><strong>Chat:</strong> Ask questions like "How does authentication work?" or "Show me the API routes"</li>
          <li><strong>Scan:</strong> Run the security scan for vulnerabilities and code quality issues</li>
          <li><strong>Tickets:</strong> Create Jira/Linear tickets directly from findings</li>
          <li><strong>Slack:</strong> Share scan summaries or enable notify-on-complete</li>
        </ul>
        <h3>4. Share & integrate</h3>
        <p>Export reports, push tickets, or connect the MCP server so your AI agents (Cursor, Claude Code, Copilot) can query the analyzed repo.</p>
      </div>
    ),
  },
  "/docs/languages": {
    title: "Supported Languages",
    description: "CodeAtlas parses and builds dependency graphs for these languages.",
    content: (
      <div className="prose prose-invert max-w-none space-y-6">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              <th className="py-2 text-left text-sm font-medium">Language</th>
              <th className="py-2 text-left text-sm font-medium">Extensions</th>
              <th className="py-2 text-left text-sm font-medium">Support Level</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {[
              ["Python", ".py", "Full (imports, classes, functions, decorators)"],
              ["JavaScript / TypeScript", ".js, .jsx, .ts, .tsx", "Full (imports, exports, dynamic imports)"],
              ["Go", ".go", "Full (imports, structs, interfaces)"],
              ["Rust", ".rs", "Full (use, mods, structs, traits)"],
              ["Java", ".java", "Full (imports, classes, interfaces)"],
              ["C#", ".cs", "Full (using, classes, interfaces)"],
              ["Ruby", ".rb", "Basic (requires, classes)"],
              ["PHP", ".php", "Basic (use, classes)"],
              ["Swift", ".swift", "Basic (import, structs, classes)"],
              ["Kotlin", ".kt", "Basic (import, classes)"],
            ].map(([lang, ext, level]) => (
              <tr key={lang} className="hover:bg-secondary/30">
                <td className="py-3 font-mono text-sm">{lang}</td>
                <td className="py-3 font-mono text-sm text-muted-foreground">{ext}</td>
                <td className="py-3 text-sm">{level}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-sm text-muted-foreground">
          Language support is extensible — the parser architecture uses Tree-sitter grammars
          and can be extended for additional languages.
        </p>
      </div>
    ),
  },
  "/docs/limits": {
    title: "Repository Limits",
    description: "Current limits during beta.",
    content: (
      <div className="prose prose-invert max-w-none space-y-6">
        <ul>
          <li><strong>Max repo size:</strong> 500 MB (cloned)</li>
          <li><strong>Max files parsed:</strong> 10,000 per session</li>
          <li><strong>Max graph nodes:</strong> 5,000 (larger repos show top-level modules)</li>
          <li><strong>Session TTL:</strong> 7 days of inactivity</li>
          <li><strong>Concurrent sessions:</strong> 3 per IP (beta)</li>
        </ul>
        <p className="text-sm text-muted-foreground">
          Limits will be adjusted based on usage patterns. Pro/Team tiers will have higher limits.
        </p>
      </div>
    ),
  },
  "/docs/graph": {
    title: "Dependency Graph",
    description: "Interactive visualization of your codebase structure.",
    content: (
      <div className="prose prose-invert max-w-none space-y-6">
        <h3>Overview</h3>
        <p>The graph shows files as nodes and imports/dependencies as edges. Nodes are colored by category (backend, frontend, config, data, util).</p>
        <h3>Interactions</h3>
        <ul>
          <li>Pan: drag background or middle-click drag</li>
          <li>Zoom: scroll wheel or pinch</li>
          <li>Click node: opens detail panel with file path, functions, classes, purpose</li>
          <li>Search: press <kbd className="px-1.5 py-0.5 rounded bg-muted border border-border">/</kbd> to focus search</li>
        </ul>
        <h3>Diagnostics banner</h3>
        <p>If unresolved imports or unparsed files are detected, a warning banner appears at the top of the canvas. This is expected for dynamic imports, missing dependencies, or unsupported language features.</p>
      </div>
    ),
  },
  "/docs/chat": {
    title: "AI Chat",
    description: "Ask questions about your codebase in natural language.",
    content: (
      <div className="prose prose-invert max-w-none space-y-6">
        <h3>How it works</h3>
        <p>The chat uses the dependency graph and file contents as context. It can answer questions about architecture, specific functions, data flow, and more.</p>
        <h3>Example questions</h3>
        <ul>
          <li>"How does authentication work in this repo?"</li>
          <li>"Show me all API routes related to payments"</li>
          <li>"What's the data flow from request to database?"</li>
          <li>"Find all usages of the UserService class"</li>
        </ul>
        <h3>Limitations</h3>
        <p>The AI only knows what's in the analyzed repository. It cannot access external documentation or private packages not included in the repo.</p>
      </div>
    ),
  },
  "/docs/scan": {
    title: "Security Scan",
    description: "Automated vulnerability and code quality analysis.",
    content: (
      <div className="prose prose-invert max-w-none space-y-6">
        <h3>What it checks</h3>
        <ul>
          <li>SQL injection, XSS, command injection</li>
          <li>Hardcoded secrets, API keys, tokens</li>
          <li>Insecure cryptography (MD5, SHA1, ECB mode)</li>
          <li>Path traversal, SSRF, XXE</li>
          <li>Code quality: N+1 queries, missing error handling, dead code</li>
        </ul>
        <h3>Severity levels</h3>
        <ul>
          <li><strong>Critical:</strong> Actively exploitable, data loss risk</li>
          <li><strong>High:</strong> Likely exploitable, significant impact</li>
          <li><strong>Medium:</strong> Potential issue, context-dependent</li>
          <li><strong>Low:</strong> Code quality, best practice violation</li>
        </ul>
        <h3>Export</h3>
        <p>Reports can be exported as JSON, CSV, TXT, or PDF (print).</p>
      </div>
    ),
  },
  "/docs/tickets": {
    title: "Ticket Queue",
    description: "Create and push tickets to Jira or Linear from scan findings.",
    content: (
      <div className="prose prose-invert max-w-none space-y-6">
        <h3>Per-finding tickets</h3>
        <p>Each scan issue with severity Critical, High, or Medium shows a "Create ticket" button. Click to create a Jira issue or Linear issue with pre-filled title, description, and severity.</p>
        <h3>Bulk create</h3>
        <p>Use the checkboxes to select multiple issues, then click "Push all to Jira" to create tickets in batch.</p>
        <h3>Jira setup</h3>
        <p>Connect Jira via the top-bar button. OAuth stores tokens server-side (encrypted at rest). No tokens in localStorage or logs.</p>
      </div>
    ),
  },
  "/docs/slack": {
    title: "Slack Integration",
    description: "Share scan summaries and get notified when scans complete.",
    content: (
      <div className="prose prose-invert max-w-none space-y-6">
        <h3>OAuth connection</h3>
        <p>Click "Connect Slack" in the top bar. Grants bot token scope for posting messages.</p>
        <h3>Share scan</h3>
        <p>In the scan report header, click "Share to Slack" → pick a channel → share. Uses Block Kit formatting with health score, top findings, and "Open in CodeAtlas" button.</p>
        <h3>Webhook fallback</h3>
        <p>If OAuth isn't an option, paste an Incoming Webhook URL (https://hooks.slack.com/…) in the share modal. Works without bot token.</p>
        <h3>Notify on complete</h3>
        <p>Toggle "Notify me when scans complete" in the share modal. Posts a completion message to your default channel once per scan.</p>
      </div>
    ),
  },
  "/docs/mcp": {
    title: "MCP Server",
    description: "Let AI agents (Cursor, Claude Code, Copilot) query your analyzed repository.",
    content: (
      <div className="prose prose-invert max-w-none space-y-6">
        <h3>What is MCP?</h3>
        <p>Model Context Protocol (MCP) lets AI assistants call tools on your behalf. CodeAtlas exposes the analyzed repo's graph, findings, and chat as MCP tools.</p>
        <h3>Available tools</h3>
        <ul>
          <li><code>get_dependency_graph</code> — nodes, edges, tech stack</li>
          <li><code>get_scan_report</code> — health score, findings, metrics</li>
          <li><code>ask_codebase</code> — natural language queries against the repo</li>
        </ul>
        <h3>Setup</h3>
        <pre className="rounded-lg border border-border bg-muted p-4 overflow-x-auto"><code>{`# Add to your MCP client config (e.g., Cursor settings.json)
{
  "mcpServers": {
    "codeatlas": {
      "command": "npx",
      "args": ["mcp-remote", "https://api.codeatlas.app/mcp"]
    }
  }
}`}</code></pre>
      </div>
    ),
  },
  "/docs/api": {
    title: "API Reference",
    description: "REST endpoints for programmatic access.",
    content: (
      <div className="prose prose-invert max-w-none space-y-6">
        <p>All endpoints are prefixed with the repo session ID (e.g. <code>/workspace?repo=owner/repo</code>).</p>
        <h3>Graph</h3>
        <pre className="rounded-lg border border-border bg-muted p-4 overflow-x-auto"><code>{`POST /graph
{ "session_id": "https://github.com/owner/repo" }
→ { nodes, edges, isolated_files, routes, unresolved_imports, unparsed_files }`}</code></pre>
        <h3>Scan</h3>
        <pre className="rounded-lg border border-border bg-muted p-4 overflow-x-auto"><code>{`POST /scan_report
{ "session_id": "..." }
→ { grade, score, summary, metrics, issues, improvements }`}</code></pre>
        <h3>Chat</h3>
        <pre className="rounded-lg border border-border bg-muted p-4 overflow-x-auto"><code>{`POST /ask
{ "session_id": "...", "question": "How does auth work?" }
→ { answer }`}</code></pre>
      </div>
    ),
  },
  "/docs/webhooks": {
    title: "Webhooks",
    description: "Receive events from CodeAtlas (scan complete, etc.).",
    content: (
      <div className="prose prose-invert max-w-none space-y-6">
        <p>Webhooks are configured per-repo in the workspace settings (coming soon). Events:</p>
        <ul>
          <li><code>scan.completed</code> — health score, finding count, report URL</li>
          <li><code>chat.question</code> — question asked, answer given (opt-in)</li>
        </ul>
        <p>Payloads are signed with HMAC-SHA256 using your webhook secret.</p>
      </div>
    ),
  },
  "/docs/data-retention": {
    title: "Data Retention",
    description: "How long we keep your code and analysis data.",
    content: (
      <div className="prose prose-invert max-w-none space-y-6">
        <h3>Repository code</h3>
        <p>Cloned repository content is deleted immediately after analysis completes. We never store your source code.</p>
        <h3>Analysis artifacts</h3>
        <ul>
          <li>Dependency graph: 7 days after last access</li>
          <li>Scan report: 30 days</li>
          <li>Chat history: 30 days</li>
          <li>Tickets: until manually deleted</li>
        </ul>
        <h3>Zero-retention mode</h3>
        <p>Enable in workspace settings to delete all artifacts immediately after the session ends. See <a href="/docs/zero-retention" className="text-primary underline">Zero-Retention Mode</a>.</p>
      </div>
    ),
  },
  "/docs/zero-retention": {
    title: "Zero-Retention Mode",
    description: "Delete all analysis data immediately after your session ends.",
    content: (
      <div className="prose prose-invert max-w-none space-y-6">
        <p>When enabled, CodeAtlas will:</p>
        <ul>
          <li>Delete the cloned repo immediately after graph construction</li>
          <li>Delete the dependency graph, scan report, and chat history when you close the workspace</li>
          <li>Not persist any analytics or telemetry linking back to your repo</li>
        </ul>
        <p>Trade-off: you'll need to re-analyze the repo on each visit. Recommended for highly sensitive codebases.</p>
      </div>
    ),
  },
  "/docs/faq": {
    title: "FAQ",
    description: "Frequently asked questions.",
    content: (
      <div className="prose prose-invert max-w-none space-y-6">
        <details className="group rounded-lg border border-border bg-card/50 p-4">
          <summary className="flex items-center justify-between cursor-pointer font-medium list-none">
            Is my code sent to third-party AI providers?
            <ChevronRight className="size-5 text-muted-foreground transition-transform group-open:rotate-90" />
          </summary>
          <p className="mt-3 text-sm text-muted-foreground">Yes, for AI chat and scan analysis we use LLMs via our backend. Repository code is not stored by providers. See <a href="/docs/data-retention" className="text-primary underline">Data Retention</a>.</p>
        </details>
        <details className="group rounded-lg border border-border bg-card/50 p-4">
          <summary className="flex items-center justify-between cursor-pointer font-medium list-none">
            Can I use CodeAtlas on private repositories?
            <ChevronRight className="size-5 text-muted-foreground transition-transform group-open:rotate-90" />
          </summary>
          <p className="mt-3 text-sm text-muted-foreground">Private repo support is coming soon (Pro tier). During beta, only public repos are supported.</p>
        </details>
        <details className="group rounded-lg border border-border bg-card/50 p-4">
          <summary className="flex items-center justify-between cursor-pointer font-medium list-none">
            How accurate is the dependency graph?
            <ChevronRight className="size-5 text-muted-foreground transition-transform group-open:rotate-90" />
          </summary>
          <p className="mt-3 text-sm text-muted-foreground">We use Tree-sitter parsers for static analysis. Dynamic imports, eval, and runtime-only dependencies may not be resolved. The diagnostics banner shows unresolved import count.</p>
        </details>
        <details className="group rounded-lg border border-border bg-card/50 p-4">
          <summary className="flex items-center justify-between cursor-pointer font-medium list-none">
            What's the difference between the demo and onboarding my own repo?
            <ChevronRight className="size-5 text-muted-foreground transition-transform group-open:rotate-90" />
          </summary>
          <p className="mt-3 text-sm text-muted-foreground">The demo analyzes the public fastapi/fastapi repo live with staged progress — no signup. Repeat visits reuse the cached analysis and load instantly. Your own repo takes 30–90s to analyze on first visit.</p>
        </details>
        <details className="group rounded-lg border border-border bg-card/50 p-4">
          <summary className="flex items-center justify-between cursor-pointer font-medium list-none">
            How do I request a new language or feature?
            <ChevronRight className="size-5 text-muted-foreground transition-transform group-open:rotate-90" />
          </summary>
          <p className="mt-3 text-sm text-muted-foreground">Email <a href="mailto:FILL-ME-CONTACT-EMAIL" className="text-primary underline">FILL-ME-CONTACT-EMAIL</a> or open an issue on GitHub.</p>
        </details>
      </div>
    ),
  },
}

function DocsContent({ slug }: { slug: string }) {
  const doc = DOCS_CONTENT[slug] || DOCS_CONTENT["/docs/quickstart"]

  return (
    <article className="flex-1 min-w-0">
      <header className="mb-10">
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">{doc.title}</h1>
        <p className="mt-3 text-lg text-muted-foreground max-w-2xl">{doc.description}</p>
      </header>
      <div className="prose prose-invert max-w-none">{doc.content}</div>
    </article>
  )
}

export function DocsPageClient({ activeHref }: { activeHref: string }) {
  return (
    <>
      <SiteHeader />
      <main className="relative min-h-screen">
        <ParticleBackground className="pointer-events-none absolute inset-0 h-full w-full opacity-70" />
        <div className="relative mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-20 lg:grid lg:grid-cols-[260px_1fr] lg:gap-8">
          <DocsSidebar activeHref={activeHref} />
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="lg:col-span-1"
          >
            <DocsContent slug={activeHref} />
          </motion.div>
        </div>
        <SiteFooter onOnboard={() => window.location.href = "/#top"} />
      </main>
    </>
  )
}