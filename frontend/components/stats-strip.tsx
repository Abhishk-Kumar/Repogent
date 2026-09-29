"use client"

import { useEffect, useState } from "react"
import { motion } from "motion/react"

const BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  (typeof window !== "undefined" ? window.location.origin : "http://localhost:8000")

interface Metrics {
  repos_analyzed: number
  analyses_completed: number
  median_analysis_seconds: number | null
  scans_completed: number
  tickets_created: number
  mcp_keys_active: number
}

function formatDuration(seconds: number | null): string {
  if (seconds === null) return "—"
  if (seconds < 60) return `${seconds}s`
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`
}

// 10.2 — live stats strip wired to GET /metrics. Real numbers only:
// renders what the backend reports, including zeros on a fresh deploy.
// Loading shows a same-height shimmer skeleton (no layout jump); a failed
// fetch hides the section cleanly instead of flashing an error.
export function StatsStrip() {
  const [metrics, setMetrics] = useState<Metrics | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    fetch(`${BASE}/metrics`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) setMetrics(data)
        else setFailed(true)
      })
      .catch(() => setFailed(true))
  }, [])

  if (failed) return null

  if (!metrics) {
    return (
      <section aria-label="CodeAtlas usage statistics" className="border-b border-border" aria-busy="true">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-6 px-4 py-10 sm:grid-cols-4 sm:px-6">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="text-center">
              <div className="mx-auto h-9 w-20 animate-pulse rounded-md bg-secondary/60" />
              <div className="mx-auto mt-2 h-3 w-24 animate-pulse rounded bg-secondary/40" />
            </div>
          ))}
        </div>
      </section>
    )
  }

  const stats = [
    { value: String(metrics.repos_analyzed), label: "repos analyzed" },
    { value: formatDuration(metrics.median_analysis_seconds), label: "median analysis" },
    { value: String(metrics.scans_completed), label: "security scans" },
    { value: String(metrics.tickets_created), label: "tickets created" },
  ]

  return (
    <section aria-label="CodeAtlas usage statistics" className="border-b border-border">
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-6 px-4 py-10 sm:grid-cols-4 sm:px-6">
        {stats.map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{ duration: 0.5, delay: i * 0.08, ease: "easeOut" }}
            className="text-center"
          >
            <p className="font-heading text-3xl font-semibold tracking-tight text-foreground">
              {s.value}
            </p>
            <p className="mt-1 text-xs uppercase tracking-wider text-muted-foreground">{s.label}</p>
          </motion.div>
        ))}
      </div>
    </section>
  )
}
