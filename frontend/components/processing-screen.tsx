"use client"

import { useEffect, useState } from "react"
import { AnimatePresence, motion } from "motion/react"
import { Check, Compass, Loader2, Sparkles, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { startPollingJob } from "@/lib/codeatlas/client"
import { useCodeAtlas } from "@/lib/codeatlas/context"

export function ProcessingScreen({
  repo,
  onClose,
  onComplete,
}: {
  repo: string
  onClose: () => void
  onComplete: (repoUrl: string) => void
}) {
  const [steps, setSteps] = useState<
    { message: string; state: "active" | "done" | "pending"; startTime?: number; endTime?: number }[]
  >([
    { message: `Analyzing ${repo}...`, state: "active", startTime: Date.now() },
    { message: "Parsing files...", state: "pending" },
    { message: "Building dependency graph...", state: "pending" },
    { message: "Running security scan...", state: "pending" },
    { message: "Generating AI summary...", state: "pending" },
  ])
  const [progress, setProgress] = useState(0)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [overallStartTime] = useState(Date.now())
  const { setOnboardResult, setJobProgress } = useCodeAtlas()
  const repoUrl = repo.startsWith("http") ? repo : `https://github.com/${repo}`

  useEffect(() => {
    const controller = new AbortController()
    const stepIndexRef = { current: 0 }

    startPollingJob(
      repoUrl,
      (message, current, total) => {
        setJobProgress({ message, current, total, status: "running" })
        const now = Date.now()
        const idx = stepIndexRef.current
        setSteps((prev) => {
          const next = [...prev]
          // Mark current step done only on its own completion callback
          if (next[idx] && next[idx].state === "active") {
            next[idx] = { ...next[idx], state: "done", endTime: now }
          }
          // Advance to next pending step
          if (idx + 1 < next.length) {
            stepIndexRef.current = idx + 1
            next[idx + 1] = { ...next[idx + 1], state: "active", startTime: now }
          }
          return next
        })
        setProgress(total > 0 ? Math.round((current / total) * 100) : (p) => Math.min(p + 18, 95))
      },
      (data) => {
        setOnboardResult({
          sessionId: data.sessionId,
          graph: data.graph,
          fileList: data.fileList,
        })
        setJobProgress({ message: "Ready", current: 100, total: 100, status: "done" })
        setSteps((prev) => {
          const next = prev.map((s) =>
            s.state === "active" ? { ...s, state: "done" as const, endTime: Date.now() } : s,
          )
          return next
        })
        setDone(true)
        setProgress(100)
      },
      (err) => {
        setJobProgress({ message: err, current: 0, total: 0, status: "failed", error: err })
        setError(err)
      },
      controller.signal,
    )

    return () => {
      controller.abort()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repoUrl])

  useEffect(() => {
    if (done) {
      const timer = setTimeout(() => {
        onComplete(repo)
      }, 1200)
      return () => clearTimeout(timer)
    }
  }, [done, repo, onComplete])

  const shown = steps

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-background/90 p-4 backdrop-blur-xl"
      role="dialog"
      aria-modal="true"
      aria-label="Onboarding repository"
    >
      <motion.div
        initial={{ scale: 0.95, y: 16, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 26 }}
        className="relative w-full max-w-md overflow-hidden rounded-2xl border border-border bg-card p-7 shadow-2xl shadow-black/50"
      >
        <button
          onClick={onClose}
          className="absolute right-4 top-4 flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          aria-label="Cancel"
        >
          <X className="size-4" />
        </button>

        <div className="flex items-center gap-3">
          <motion.span
            animate={done ? {} : { rotate: 360 }}
            transition={
              done
                ? {}
                : { repeat: Infinity, duration: 8, ease: "linear" }
            }
            className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground"
          >
            {done ? <Sparkles className="size-5" /> : <Compass className="size-5" />}
          </motion.span>
          <div>
            <h2 className="text-base font-semibold">
              {error
                ? "Error"
                : done
                  ? "Ready to explore"
                  : "Onboarding repository"}
            </h2>
            <p className="font-mono text-xs text-muted-foreground">{repo}</p>
          </div>
        </div>

        <div className="mt-6">
          <div className="mb-2 flex justify-between text-xs text-muted-foreground">
            <span>
              {error ? "Failed" : done ? "Complete" : "Analyzing..."}
            </span>
            <span className="font-mono">{progress}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-secondary">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-emerald-500"
              animate={{
                width: error ? "100%" : `${progress}%`,
              }}
              transition={{ ease: "easeOut", duration: 0.5 }}
            />
          </div>
        </div>

        {error ? (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-6 rounded-xl border border-orange-500/30 bg-orange-500/10 p-4"
          >
            <p className="text-sm text-orange-500">{error}</p>
            <Button
              onClick={onClose}
              variant="outline"
              className="mt-3 w-full rounded-lg"
            >
              Go back
            </Button>
          </motion.div>
        ) : (
          <>
            <div className="mb-4 text-right text-xs text-muted-foreground/70">
              Elapsed: {Math.round((Date.now() - overallStartTime) / 1000)}s
              {!done && progress > 0 && progress < 100 && (
                <>
                  <span className="mx-2">·</span>
                  ETA: ~{Math.round(((Date.now() - overallStartTime) / progress) * (100 - progress) / 1000)}s
                </>
              )}
            </div>
            <ul className="mt-6 max-h-64 space-y-3 overflow-y-auto thin-scroll">
              {shown.map((step, i) => {
                const elapsed = step.endTime
                  ? Math.round((step.endTime - (step.startTime || Date.now())) / 1000)
                  : step.startTime
                    ? Math.round((Date.now() - step.startTime) / 1000)
                    : 0
                return (
                  <li key={i} className="flex items-center gap-3">
                    <span
                      className={`flex size-5 shrink-0 items-center justify-center rounded-full border transition-colors ${
                        step.state === "done"
                          ? "border-emerald-500 bg-emerald-500 text-white"
                          : step.state === "active"
                            ? "border-indigo-500 text-indigo-400"
                            : "border-border text-muted-foreground"
                      }`}
                    >
                      <AnimatePresence mode="wait">
                        {step.state === "done" ? (
                          <motion.span
                            key="check"
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{
                              type: "spring",
                              stiffness: 500,
                              damping: 20,
                            }}
                          >
                            <Check className="size-3" />
                          </motion.span>
                        ) : step.state === "active" ? (
                          <Loader2 className="size-3 animate-spin" />
                        ) : (
                          <span className="size-1.5 rounded-full bg-current opacity-40" />
                        )}
                      </AnimatePresence>
                    </span>
                    <span
                      className={`font-mono text-sm transition-colors ${
                        step.state === "pending"
                          ? "text-muted-foreground/60"
                          : "text-foreground"
                      }`}
                    >
                      {step.message}
                    </span>
                    {(step.state === "done" || step.state === "active") && (
                      <span className="ml-auto font-mono text-xs text-muted-foreground/70">
                        {elapsed}s
                      </span>
                    )}
                  </li>
                )
              })}
            </ul>
          </>
        )}
      </motion.div>
    </motion.div>
  )
}
