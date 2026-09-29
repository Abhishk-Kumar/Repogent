"use client"

import { Copy, Check, ExternalLink } from "lucide-react"
import { useState } from "react"
import { motion } from "motion/react"
import { Button } from "@/components/ui/button"
import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"
import { ParticleBackground } from "@/components/codeatlas/particle-bg"
import { cn } from "@/lib/utils"

const CLIENTS = [
  {
    id: "cursor",
    name: "Cursor",
    description: "AI-first code editor with built-in MCP support",
    icon: (
      <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
      </svg>
    ),
    color: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
    config: (repo: string, key: string, httpUrl: string) => ({
      mcpServers: {
        codeatlas: {
          command: "npx",
          args: ["-y", "codeatlas-mcp", "--repo", repo, "--key", key],
          env: {},
        },
      },
    }),
    docsUrl: "https://cursor.sh/docs/mcp",
  },
  {
    id: "claude-code",
    name: "Claude Code",
    description: "Anthropic's CLI agent with MCP support",
    icon: (
      <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
      </svg>
    ),
    color: "bg-purple-500/10 text-purple-500 border-purple-500/20",
    config: (repo: string, key: string, httpUrl: string) => ({
      mcpServers: {
        codeatlas: {
          command: "npx",
          args: ["-y", "codeatlas-mcp", "--repo", repo, "--key", key],
          env: {},
        },
      },
    }),
    docsUrl: "https://docs.anthropic.com/en/docs/agents-and-tools/mcp",
  },
  {
    id: "opencode",
    name: "OpenCode",
    description: "Open-source AI coding agent with MCP",
    icon: (
        <svg className="size-5" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/>
        </svg>
      ),
    color: "bg-blue-500/10 text-blue-500 border-blue-500/20",
    config: (repo: string, key: string, httpUrl: string) => ({
      mcpServers: {
        codeatlas: {
          command: "npx",
          args: ["-y", "codeatlas-mcp", "--repo", repo, "--key", key],
          env: {},
        },
      },
    }),
    docsUrl: "https://opencode.ai/docs/mcp",
  },
  {
    id: "http",
    name: "Streamable HTTP (Remote)",
    description: "For hosted/remote MCP servers with API key auth",
    icon: (
        <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
          <line x1="10" y1="9" x2="8" y2="9" />
        </svg>
      ),
    color: "bg-amber-500/10 text-amber-500 border-amber-500/20",
    config: (repo: string, key: string, httpUrl: string) => ({
      mcpServers: {
        codeatlas: {
          url: `${httpUrl}/mcp`,
          headers: {
            Authorization: `Bearer ${key}`,
          },
        },
      },
    }),
    docsUrl: "https://spec.modelcontextprotocol.io/specification/2024-11-05/basic/transports/#streamable-http",
  },
]

function ConfigBlock({ config, onCopy }: { config: any; onCopy: () => void }) {
  const [copied, setCopied] = useState(false)

  return (
    <div className="relative group">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-muted-foreground">Configuration (JSON)</span>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => {
            onCopy()
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
          }}
          className="opacity-0 group-hover:opacity-100 transition-opacity"
          aria-label="Copy configuration"
        >
          {copied ? <Check className="size-4 text-emerald-500" /> : <Copy className="size-4" />}
        </Button>
      </div>
      <pre className="rounded-lg border border-border bg-muted p-4 overflow-x-auto text-[11px] font-mono text-muted-foreground">
        {JSON.stringify(config, null, 2)}
      </pre>
    </div>
  )
}

function ClientCard({ client, repo, apiKey, httpUrl, onCopy }: {
  client: typeof CLIENTS[0]
  repo: string
  apiKey: string
  httpUrl: string
  onCopy: () => void
}) {
  const config = client.config(repo, apiKey, httpUrl)

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className={`rounded-2xl border p-6 space-y-4 ${client.color}`}
    >
      <div className="flex items-center gap-3">
        <div className={`flex size-10 items-center justify-center rounded-xl ${client.color.replace("border-", "bg-").replace("text-", "text-")}`}>
          {client.icon}
        </div>
        <div>
          <h3 className="font-semibold text-foreground">{client.name}</h3>
          <p className="text-sm text-muted-foreground">{client.description}</p>
        </div>
      </div>

      <ConfigBlock config={config} onCopy={onCopy} />

      <a
        href={client.docsUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
      >
        View {client.name} MCP docs
        <ExternalLink className="size-4" />
      </a>
    </motion.div>
  )
}

export default function ConnectAgentPage() {
  const [repo, setRepo] = useState("owner/repo")
  const [key, setKey] = useState("ca_abc123def456...")
  const [httpUrl, setHttpUrl] = useState("https://api.codeatlas.app")
  const [copied, setCopied] = useState<string | null>(null)

  const handleCopy = (clientId: string) => {
    setCopied(clientId)
    setTimeout(() => setCopied(null), 2000)
  }

  return (
    <>
      <SiteHeader />
      <main className="relative min-h-screen">
        <ParticleBackground className="pointer-events-none absolute inset-0 h-full w-full opacity-70" />
        <div className="relative mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-20">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="text-center mb-12"
          >
            <h1 className="text-balance text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl">
              Connect Your Agent
            </h1>
            <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
              Add CodeAtlas as an MCP server to Cursor, Claude Code, OpenCode, or any MCP-compatible
              agent. Your agent can then query the dependency graph, scan findings, and chat with
              the codebase directly from your editor.
            </p>
          </motion.div>

          {/* Config Inputs */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1, ease: "easeOut" }}
            className="rounded-2xl border border-border bg-card/50 p-6 mb-10 space-y-4"
          >
            <h2 className="text-xl font-semibold mb-4">Your Configuration</h2>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <label className="block text-xs font-medium text-muted-foreground">Repository</label>
                <input
                  type="text"
                  value={repo}
                  onChange={e => setRepo(e.target.value)}
                  placeholder="owner/repo"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary/40"
                />
                <p className="text-xs text-muted-foreground">The GitHub repo (e.g., vercel/next.js)</p>
              </div>
              <div className="space-y-2">
                <label className="block text-xs font-medium text-muted-foreground">API Key</label>
                <input
                  type="text"
                  value={key}
                  onChange={e => setKey(e.target.value)}
                  placeholder="ca_..."
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary/40"
                />
                <p className="text-xs text-muted-foreground">Generate in Workspace → Settings</p>
              </div>
              <div className="space-y-2">
                <label className="block text-xs font-medium text-muted-foreground">HTTP Endpoint (optional)</label>
                <input
                  type="text"
                  value={httpUrl}
                  onChange={e => setHttpUrl(e.target.value)}
                  placeholder="https://api.codeatlas.app"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary/40"
                />
                <p className="text-xs text-muted-foreground">For Streamable HTTP transport</p>
              </div>
            </div>
          </motion.div>

          {/* Client Configs */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2, ease: "easeOut" }}
          >
            <h2 className="text-xl font-semibold mb-6">MCP Clients</h2>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {CLIENTS.map((client) => (
                <ClientCard
                  key={client.id}
                  client={client}
                  repo={repo}
                  apiKey={key}
                  httpUrl={httpUrl}
                  onCopy={() => handleCopy(client.id)}
                />
              ))}
            </div>
          </motion.div>

          {/* How it works */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3, ease: "easeOut" }}
            className="mt-16 rounded-2xl border border-border bg-card/50 p-6 space-y-4"
          >
            <h2 className="text-xl font-semibold">How it works</h2>
            <div className="grid gap-4 sm:grid-cols-3">
              {[
                {
                  title: "1. Generate API Key",
                  desc: "Go to Workspace → Settings → MCP Settings and create an API key for your repository.",
                },
                {
                  title: "2. Configure Your Agent",
                  desc: "Copy the JSON config for your agent (Cursor, Claude Code, etc.) and add it to your MCP settings.",
                },
                {
                  title: "3. Ask Your Agent",
                  desc: "Ask questions like \"Where is auth handled?\" or \"Show me the dependency graph for payments\" — your agent queries CodeAtlas via MCP.",
                },
              ].map((step, i) => (
                <motion.div
                  key={step.title}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: 0.35 + i * 0.08, ease: "easeOut" }}
                  className="rounded-xl border border-border bg-card/50 p-5"
                >
                  <h3 className="font-semibold mb-2">{step.title}</h3>
                  <p className="text-sm text-muted-foreground">{step.desc}</p>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Available Tools */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4, ease: "easeOut" }}
            className="mt-10 rounded-2xl border border-border bg-card/50 p-6"
          >
            <h2 className="text-xl font-semibold mb-4">Available MCP Tools</h2>
            <div className="space-y-3 text-sm">
              {[
                { name: "list_files", desc: "List all files in the analyzed repository as a tree" },
                { name: "get_dependency_graph", desc: "Get nodes + edges for the full repo or a specific file's subgraph" },
                { name: "get_scan_findings", desc: "Get security findings with optional severity filter (critical/high/medium/low)" },
                { name: "ask_codebase", desc: "Natural language Q&A over the codebase (RAG over analyzed repo)" },
                { name: "get_health_score", desc: "Get health score, grade, and metrics breakdown" },
              ].map((tool) => (
                <div key={tool.name} className="flex gap-3 rounded-lg border border-border bg-card/50 p-3 hover:border-primary/30 transition-colors">
                  <code className="font-mono text-primary shrink-0">{tool.name}</code>
                  <span className="text-muted-foreground">{tool.desc}</span>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
        <SiteFooter onOnboard={() => window.location.href = "/#top"} />
      </main>
    </>
  )
}