"use client"

import { ChevronDown, ChevronUp, Sparkles, Bug, Wrench, Trash2, GitPullRequest } from "lucide-react"
import { useState } from "react"
import { motion, AnimatePresence } from "motion/react"
import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"
import { ParticleBackground } from "@/components/codeatlas/particle-bg"

type ChangeType = "feature" | "improvement" | "fix" | "removal"

const CHANGELOG: { version: string; date: string; title: string; changes: { type: ChangeType; title: string; description: string }[] }[] = [
  {
    version: "v0.4.0",
    date: "2025-01-25",
    title: "Ticket System + Slack Integration",
    changes: [
      { type: "feature", title: "Ticket queue → Jira / Linear", description: "Per-finding 'Create ticket' button with pre-filled title, description, severity. Bulk 'Push all to Jira' for multiple issues." },
      { type: "feature", title: "Slack sharing (Block Kit)", description: "Share scan summary to any channel — health score, grade, top 3 findings, 'Open in CodeAtlas' button." },
      { type: "feature", title: "Slack webhook fallback", description: "Paste an Incoming Webhook URL (https://hooks.slack.com/…) — works without OAuth." },
      { type: "feature", title: "Notify on scan complete", description: "Opt-in toggle posts completion message to default channel exactly once per scan." },
      { type: "improvement", title: "Graph diagnostics banner", description: "Shows unresolved import count and unparsed file count — never fake zeros." },
      { type: "improvement", title: "Scan report export", description: "JSON, CSV, TXT, and PDF (print) export from scan report header." },
      { type: "improvement", title: "Copy badge markdown", description: "Health header badge copies as shields.io markdown." },
    ],
  },
  {
    version: "v0.3.0",
    date: "2025-01-15",
    title: "Security Scan + AI Chat",
    changes: [
      { type: "feature", title: "Automated security scan", description: "SQLi, XSS, secrets, crypto, path traversal, SSRF, XXE + code quality (N+1, dead code, error handling)." },
      { type: "feature", title: "AI chat over codebase", description: "Ask natural-language questions — answers grounded in dependency graph + file contents." },
      { type: "feature", title: "Health score A–F grading", description: "Context-aware metrics per repo type (backend, frontend, library, etc.)." },
      { type: "improvement", title: "Import resolution diagnostics", description: "unresolved_imports and unparsed_files fields in graph response." },
      { type: "improvement", title: "JS/TS resolver enhancements", description: "Dynamic imports, side-effect imports, re-exports, destructured requires." },
    ],
  },
  {
    version: "v0.2.0",
    date: "2025-01-05",
    title: "Interactive Dependency Graph",
    changes: [
      { type: "feature", title: "React Flow graph canvas", description: "Pan, zoom, click nodes for file details (functions, classes, purpose, folder)." },
      { type: "feature", title: "Multi-language parsing", description: "Python, JavaScript, TypeScript, Go, Rust, Java, C# with Tree-sitter." },
      { type: "feature", title: "Folder/category coloring", description: "Backend (green), Frontend (blue), Config (yellow), Data (purple), Util (gray)." },
      { type: "improvement", title: "Onboarding flow", description: "Paste GitHub URL → clone → parse → graph in 30–90s." },
      { type: "fix", title: "Mobile responsive workspace", description: "390px verified, tap targets ≥44px, no horizontal scroll." },
    ],
  },
  {
    version: "v0.1.0",
    date: "2024-12-20",
    title: "Initial Release",
    changes: [
      { type: "feature", title: "Repository onboarding", description: "GitHub URL or owner/repo format, public repos only during beta." },
      { type: "feature", title: "Basic graph + chat skeleton", description: "Foundation for v0.2+ features." },
      { type: "improvement", title: "Dark theme + emerald accent", description: "Design tokens locked — consistent across all pages." },
    ],
  },
]

function ChangeIcon({ type }: { type: ChangeType }) {
  switch (type) {
    case "feature": return <Sparkles className="size-4 text-emerald-500" />
    case "improvement": return <Wrench className="size-4 text-blue-500" />
    case "fix": return <Bug className="size-4 text-amber-500" />
    case "removal": return <Trash2 className="size-4 text-red-500" />
  }
}

function ChangeTypeLabel({ type }: { type: ChangeType }) {
  const labels: Record<ChangeType, { label: string; color: string }> = {
    feature: { label: "New", color: "bg-emerald-500/10 text-emerald-500" },
    improvement: { label: "Improved", color: "bg-blue-500/10 text-blue-500" },
    fix: { label: "Fixed", color: "bg-amber-500/10 text-amber-500" },
    removal: { label: "Removed", color: "bg-red-500/10 text-red-500" },
  }
  const l = labels[type]
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${l.color}`}>{l.label}</span>
}

function VersionSection({ version, date, title, changes }: typeof CHANGELOG[0]) {
  const [open, setOpen] = useState(true)

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="rounded-xl border border-border bg-card/50 overflow-hidden"
    >
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between gap-4 p-5 text-left transition-colors hover:bg-secondary/30"
        aria-expanded={open}
      >
        <div className="flex items-center gap-3">
          <span className="font-mono text-lg font-semibold text-primary">{version}</span>
          <span className="text-sm text-muted-foreground">{date}</span>
          <span className="text-sm font-medium text-foreground">{title}</span>
        </div>
        {open ? <ChevronUp className="size-5 text-muted-foreground" /> : <ChevronDown className="size-5 text-muted-foreground" />}
      </button>
      <AnimatePresence>
        {open && (
          <motion.ul
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="overflow-hidden px-5 pb-5 space-y-3"
          >
            {changes.map((change, i) => (
              <motion.li
                key={`${version}-${i}`}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: i * 0.04, ease: "easeOut" }}
                className="flex gap-3"
              >
                <ChangeIcon type={change.type} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <ChangeTypeLabel type={change.type} />
                    <span className="font-medium text-foreground">{change.title}</span>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{change.description}</p>
                </div>
              </motion.li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

export function ChangelogContent() {
  return (
    <>
      <SiteHeader />
      <main className="relative min-h-screen">
        <ParticleBackground className="pointer-events-none absolute inset-0 h-full w-full opacity-70" />
        <div className="relative mx-auto max-w-3xl px-4 py-20 sm:px-6 lg:py-28">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="text-center mb-16"
          >
            <h1 className="text-balance text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl">
              Changelog
            </h1>
            <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
              All notable changes. We follow <a href="https://keepachangelog.com" target="_blank" rel="noopener noreferrer" className="text-primary underline">Keep a Changelog</a> format.
            </p>
          </motion.div>

          <div className="space-y-4">
            {CHANGELOG.map((entry, i) => (
              <VersionSection key={entry.version} {...entry} />
            ))}
          </div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3, ease: "easeOut" }}
            className="mt-16 rounded-xl border border-border bg-card/50 p-6 text-center"
          >
            <h3 className="text-lg font-semibold">Want early access to new features?</h3>
            <p className="mt-2 text-sm text-muted-foreground mb-4">
              Join the beta — free while in beta, grandfathered pricing.
            </p>
            <a
              href="/#top"
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#34d399] px-5 py-2.5 text-sm font-medium text-black transition-colors hover:bg-[#34d399]/90"
            >
              Try CodeAtlas Free
              <GitPullRequest className="size-4" />
            </a>
          </motion.div>
        </div>
        <SiteFooter onOnboard={() => window.location.href = "/#top"} />
      </main>
    </>
  )
}