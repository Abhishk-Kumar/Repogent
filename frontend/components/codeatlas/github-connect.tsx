"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "motion/react"
import { toast } from "sonner"
import { GitPullRequest, Check, Loader2 } from "lucide-react"

const BASE = process.env.NEXT_PUBLIC_API_BASE_URL || (typeof window !== 'undefined' ? window.location.origin : "http://localhost:8000")

export function GitHubConnect({ repoUrl }: { repoUrl: string }) {
  const [connected, setConnected] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleToggle = async () => {
    setLoading(true)
    try {
      if (connected) {
        await fetch(`${BASE}/github/disconnect`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ repo_url: repoUrl }),
        })
        setConnected(false)
      } else {
        document.cookie = `github_connect_repo=${encodeURIComponent(repoUrl)}; path=/; max-age=300`
        const installUrl = `https://github.com/apps/repogent-ai/installations/new`
        window.open(installUrl, "_blank", "noopener,noreferrer")
      }
    } catch {
      toast.error("GitHub request failed. Is the backend running?")
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleToggle}
      disabled={loading}
      className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs transition-all ${
        connected
          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20"
          : "border-border bg-card text-muted-foreground hover:border-indigo-500/40 hover:text-indigo-400"
      }`}
    >
      {loading ? (
        <Loader2 className="size-3 animate-spin" />
      ) : connected ? (
        <Check className="size-3" />
      ) : (
        <svg className="size-3" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/></svg>
      )}
      <AnimatePresence mode="wait">
        {connected ? (
          <motion.span
            key="connected"
            initial={{ opacity: 0, width: 0 }}
            animate={{ opacity: 1, width: "auto" }}
            exit={{ opacity: 0, width: 0 }}
            className="overflow-hidden"
          >
            Connected
          </motion.span>
        ) : (
          <motion.span
            key="connect"
            initial={{ opacity: 0, width: 0 }}
            animate={{ opacity: 1, width: "auto" }}
            exit={{ opacity: 0, width: 0 }}
            className="overflow-hidden"
          >
            Connect GitHub
          </motion.span>
        )}
      </AnimatePresence>
    </button>
  )
}
