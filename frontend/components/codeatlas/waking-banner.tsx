"use client"

import { useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Loader2, AlertCircle, RefreshCw } from "lucide-react"
import { useBackendStatus } from "@/lib/codeatlas/config"

export function WakingBanner() {
  const { state, elapsedSeconds, warmUp } = useBackendStatus()

  if (state === "idle") return null

  const isReducedMotion = typeof window !== "undefined" && 
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches

  if (state === "ready") {
    return (
      <AnimatePresence>
        <motion.div
          key="ready"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3 }}
          className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-sm font-medium text-emerald-500 shadow-lg"
        >
          <span className="flex size-4 items-center justify-center">
            <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
          </span>
          Backend is ready
        </motion.div>
      </AnimatePresence>
    )
  }

  if (state === "failed") {
    return (
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-2 rounded-lg border border-orange-500/30 bg-orange-500/10 px-4 py-2.5 text-sm font-medium text-orange-500 shadow-lg">
        <AlertCircle className="size-4 shrink-0" />
        <span>Still starting up. Please retry in a moment</span>
        <button
          onClick={() => warmUp()}
          className="ml-2 flex items-center gap-1.5 rounded bg-orange-500 px-2.5 py-1 text-xs font-medium text-white hover:bg-orange-400"
        >
          <RefreshCw className="size-3" />
          Retry
        </button>
      </div>
    )
  }

  // state === "waking"
  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-3 rounded-lg border border-primary/30 bg-primary/10 px-4 py-2.5 text-sm font-medium text-primary shadow-lg">
      <Loader2 className={isReducedMotion ? "size-4" : "size-4 animate-spin"} aria-hidden="true" />
      <span>
        The backend is waking up (free-tier hosting). This can take up to a minute, hang tight!
      </span>
      <span className="font-mono text-xs opacity-70">
        {elapsedSeconds}s elapsed
      </span>
    </div>
  )
}