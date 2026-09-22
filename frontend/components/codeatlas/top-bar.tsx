"use client"

import { AnimatePresence, motion } from "motion/react"
import { Check, FolderGit2, GitBranch, TriangleAlert, Loader2 } from "lucide-react"
import { useMemo } from "react"
import { CompassLogo } from "./compass-logo"
import { useCodeAtlas } from "@/lib/codeatlas/context"
import { GitHubConnect } from "./github-connect"
import type { AgentActivity } from "@/lib/codeatlas/types"

function StatusIndicator({ state }: { state: AgentActivity["state"] }) {
  if (state === "complete") {
    return (
      <motion.span
        key="complete"
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 500, damping: 18 }}
        className="flex size-4 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-500"
      >
        <Check className="size-2.5" strokeWidth={3} />
      </motion.span>
    )
  }
  if (state === "warning") {
    return (
      <span className="flex size-4 items-center justify-center rounded-full bg-orange-500/15 text-orange-500">
        <TriangleAlert className="size-2.5" />
      </span>
    )
  }
  return (
    <span className="relative flex size-4 items-center justify-center">
      <span
        className="absolute size-2.5 rounded-full bg-indigo-500"
        style={{ animation: "ca-pulse-dot 1.4s ease-in-out infinite" }}
      />
      <span className="absolute size-4 rounded-full bg-indigo-500/20" />
    </span>
  )
}

function ActivityBar() {
  const { onboardResult, jobProgress } = useCodeAtlas()

  const activity: AgentActivity[] = useMemo(() => {
    if (jobProgress) {
      if (jobProgress.status === "failed") {
        return [
          { id: "err", text: `Failed: ${jobProgress.error || jobProgress.message}`, state: "warning" as const },
        ]
      }
      if (jobProgress.status === "running" || jobProgress.status === "pending") {
        const progressText = jobProgress.total > 0
          ? `(${jobProgress.current}/${jobProgress.total})`
          : ""
        return [
          { id: "prog", text: `${jobProgress.message} ${progressText}`.trim(), state: "active" as const },
        ]
      }
    }

    if (!onboardResult) return []

    const items: AgentActivity[] = [
      { id: "a1", text: "Repository cloned and analyzed", state: "complete" },
      { id: "a2", text: `Dependency graph: ${onboardResult.graph.nodes.length} nodes, ${onboardResult.graph.edges.length} edges`, state: "complete" },
      { id: "a3", text: `${onboardResult.graph.tech.length} technologies detected`, state: "complete" },
    ]
    if (jobProgress?.status === "done") {
      items.push({ id: "a4", text: "Ready — explore the graph, chat, or run a scan", state: "complete" })
    } else {
      items.push({ id: "a4", text: "Ready — explore the graph, chat, or run a scan", state: "active" })
    }
    return items
  }, [onboardResult, jobProgress])

  if (activity.length === 0) return null

  return (
    <div className="flex h-9 items-center gap-3 border-b border-border bg-card px-4 sm:px-6">
      <span className="hidden shrink-0 text-xs font-medium uppercase tracking-wider text-muted-foreground/70 sm:inline">
        Agent
      </span>
      <div className="flex flex-1 items-center gap-2 truncate">
        {activity.slice(-1).map((a) => (
          <div key={a.id} className="flex items-center gap-2 text-xs subpixel-antialiased">
            <StatusIndicator state={a.state} />
            <span
              className={
                a.state === "warning"
                  ? "text-orange-500 truncate"
                  : a.state === "active"
                    ? "text-foreground truncate"
                    : "text-muted-foreground truncate"
              }
            >
              {a.text}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function TopBar() {
  const { onboardResult } = useCodeAtlas()

  const sessionId = onboardResult?.sessionId ?? null
  const repoShort = sessionId
    ? sessionId.replace(/^https?:\/\/github\.com\//, "")
    : null

  return (
    <header className="z-20 flex flex-col">
      {/* main nav */}
      <div className="flex h-14 items-center justify-between border-b border-border px-4 sm:px-6">
        <div className="flex items-center gap-2.5">
          <span className="flex size-7 items-center justify-center rounded-lg bg-indigo-500/12 text-indigo-500">
            <CompassLogo className="size-4" />
          </span>
          <span className="font-heading text-[15px] font-semibold tracking-tight">
            Code<span className="text-indigo-500">Atlas</span>
          </span>
          {repoShort && (
            <motion.span
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              className="ml-2 hidden items-center gap-1.5 rounded-md border border-border bg-card px-2 py-1 font-mono text-xs text-muted-foreground sm:flex"
            >
              <FolderGit2 className="size-3" />
              {repoShort}
            </motion.span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {repoShort && (
            <>
              <GitHubConnect repoUrl={sessionId!} />
              <a
                href="/"
                className="hidden items-center gap-1 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:border-emerald-500/40 hover:text-emerald-500 md:flex"
              >
                <svg className="size-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
                Onboard Another Repo
              </a>
              <span className="hidden items-center gap-1.5 rounded-md border border-border bg-card px-2 py-1 font-mono text-xs text-muted-foreground md:flex">
                <GitBranch className="size-3" />
                main
              </span>
            </>
          )}
          <div className="size-7 rounded-full bg-gradient-to-br from-indigo-500/70 to-emerald-500/30 ring-2 ring-background" />
        </div>
      </div>

      {/* agent activity bar */}
      <ActivityBar />
    </header>
  )
}
