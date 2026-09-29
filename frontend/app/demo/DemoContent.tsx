"use client"

import { Suspense } from "react"
import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Workspace } from "@/components/codeatlas/workspace"
import { CodeAtlasProvider, useCodeAtlas } from "@/lib/codeatlas/context"
import { setSessionId } from "@/lib/codeatlas/api"
import { ProcessingScreen } from "@/components/processing-screen"
import { motion } from "motion/react"

// Demo analyzes the fastapi/fastapi sample repo live on first visit and
// reuses the cached session afterwards. No signup; honest staged progress
// while analysis runs (a large sample takes a few minutes cold).
const DEMO_REPO = "fastapi/fastapi"
const DEMO_SESSION_ID = `https://github.com/${DEMO_REPO}`

export function DemoContent() {
  const { onboardResult } = useCodeAtlas()

  // Immediately hydrate the demo session
  try {
    setSessionId(DEMO_SESSION_ID)
  } catch {
    // Session hydration is best-effort; workspace handles missing session
  }

  // Analysis finished (now or on a previous visit) → interactive workspace.
  if (onboardResult?.sessionId) {
    return <Workspace />
  }

  // Otherwise run a real analysis job with staged progress + error state.
  // ProcessingScreen sets the onboard result on completion, which flips
  // this component to the workspace above. Never stuck loading: every
  // terminal state (done/error) is rendered by ProcessingScreen.
  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-background">
      <div className="flex items-center justify-between border-b border-border px-4 py-2.5 sm:px-6">
        <p className="text-xs text-muted-foreground">
          Live demo — analyzing <span className="font-mono text-foreground">{DEMO_REPO}</span>.
          First run takes a few minutes; follow each stage below.
        </p>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/">
            Try with your own repo
            <ArrowRight className="size-3.5" />
          </Link>
        </Button>
      </div>
      <div className="relative min-h-0 flex-1">
        <ProcessingScreen
          repo={DEMO_REPO}
          onClose={() => {
            window.location.href = "/"
          }}
          onComplete={() => {}}
        />
      </div>
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="border-t border-border px-4 py-2 text-center text-[11px] text-muted-foreground"
      >
        No signup. Subsequent visits reuse the cached analysis and load instantly.
      </motion.p>
    </div>
  )
}

export function DemoPageClient() {
  return (
    <CodeAtlasProvider>
      <Suspense fallback={<div className="flex h-dvh items-center justify-center bg-background text-muted-foreground">Loading demo…</div>}>
        <DemoContent />
      </Suspense>
    </CodeAtlasProvider>
  )
}
