"use client"

import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { Activity, TrendingUp, TrendingDown, Minus } from "lucide-react"
import { useCodeAtlas } from "@/lib/codeatlas/context"

const BASE = process.env.NEXT_PUBLIC_API_BASE_URL || (typeof window !== 'undefined' ? window.location.origin : "http://localhost:8000")

interface HistoryEntry {
  health_score: number
  complexity_score: number
  test_coverage: number
  doc_coverage: number
  scanned_at: string
}

function SimpleLineChart({ data, color }: { data: number[]; color: string }) {
  if (data.length < 2) return null
  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  const w = 240
  const h = 80
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w
    const y = h - ((v - min) / range) * (h - 10) - 5
    return `${x},${y}`
  })
  const pathD = `M${points.join(" L")}`

  return (
    <svg width={w} height={h} className="w-full" viewBox={`0 0 ${w} ${h}`}>
      <motion.path
        d={pathD}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 1, ease: "easeInOut" }}
      />
      {data.map((v, i) => (
        <circle
          key={i}
          cx={parseFloat(points[i].split(",")[0])}
          cy={parseFloat(points[i].split(",")[1])}
          r="3"
          fill={color}
          className="opacity-60"
        />
      ))}
    </svg>
  )
}

function TrendBadge({ current, previous }: { current: number; previous?: number }) {
  if (previous === undefined) return null
  const diff = current - previous
  if (Math.abs(diff) < 1) {
    return <Minus className="size-3 text-muted-foreground" />
  }
  return diff > 0
    ? <TrendingUp className="size-3 text-emerald-500" />
    : <TrendingDown className="size-3 text-orange-500" />
}

export function HistoryTab() {
  const { onboardResult } = useCodeAtlas()
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const repoUrl = onboardResult?.sessionId ?? ""

  useEffect(() => {
    if (!repoUrl) return
    fetch(`${BASE}/scan_history/${encodeURIComponent(repoUrl)}`)
      .then(r => r.json())
      .then(data => setHistory(Array.isArray(data) ? data : []))
      .catch(() => {})
  }, [repoUrl])

  if (history.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
        <Activity className="size-8 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">No scan history yet</p>
        <p className="text-xs text-muted-foreground/60">
          Run a scan to start tracking health trends over time
        </p>
      </div>
    )
  }

  const scores = history.map(h => h.health_score)
  const complexities = history.map(h => h.complexity_score)
  const tests = history.map(h => h.test_coverage)
  const docs = history.map(h => h.doc_coverage)
  const latest = history[history.length - 1]
  const previous = history.length > 1 ? history[history.length - 2] : undefined

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border px-4 py-2.5">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Scan History
        </p>
      </div>

      <div className="thin-scroll flex-1 space-y-4 overflow-y-auto p-4">
        {/* current snapshot */}
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="mb-3 text-xs font-medium text-muted-foreground">Latest Scan</p>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Health Score", value: latest.health_score, color: "var(--accent-action, #10b981)" },
              { label: "Complexity", value: latest.complexity_score, color: "var(--accent-primary, #6366f1)" },
              { label: "Test Coverage", value: latest.test_coverage, color: "var(--sev-medium, #f59e0b)" },
              { label: "Doc Coverage", value: latest.doc_coverage, color: "var(--sev-high, #f97316)" },
            ].map(m => (
              <div key={m.label} className="rounded-lg bg-secondary/50 p-3">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  {m.label}
                  <TrendBadge current={m.value} previous={previous?.[
                    m.label === "Health Score" ? "health_score" :
                    m.label === "Complexity" ? "complexity_score" :
                    m.label === "Test Coverage" ? "test_coverage" : "doc_coverage"
                  ] as number | undefined} />
                </div>
                <p className="mt-1 font-mono text-lg font-semibold" style={{ color: m.color }}>
                  {Math.round(m.value)}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* trend charts */}
        {scores.length > 1 && (
          <>
            <ChartCard title="Health Score Trend" data={scores} color="#10b981" />
            <ChartCard title="Complexity Trend" data={complexities} color="#6366f1" />
            <ChartCard title="Test Coverage Trend" data={tests} color="#f59e0b" />
            <ChartCard title="Doc Coverage Trend" data={docs} color="#f97316" />
          </>
        )}
      </div>
    </div>
  )
}

function ChartCard({ title, data, color }: { title: string; data: number[]; color: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="mb-3 text-xs font-medium text-muted-foreground">{title}</p>
      <SimpleLineChart data={data} color={color} />
      <div className="mt-2 flex justify-between text-[11px] text-muted-foreground/60">
        <span>oldest</span>
        <span>latest</span>
      </div>
    </div>
  )
}
