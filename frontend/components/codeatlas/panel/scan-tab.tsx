"use client"

import { AnimatePresence, motion } from "motion/react"
import {
  ChevronDown,
  Lightbulb,
  Wrench,
  AlertCircle,
  Download,
  GitPullRequest,
  Sparkles,
  Loader2,
  ExternalLink,
  Share2,
} from "lucide-react"
import { toast } from "sonner"
import { useEffect, useRef, useState } from "react"
import { Check, TicketPlus } from "lucide-react"
import { SEVERITY_META } from "../style-maps"
import { ScanSkeleton } from "../skeletons"
import { createTicket, createTicketsBulk, fetchScanReport, listTickets, saveScanHistory } from "@/lib/codeatlas/api"
import { ShareToSlackButton } from "../slack-share"
import { useCodeAtlas } from "@/lib/codeatlas/context"
import type { ScanReport, Severity, Ticket } from "@/lib/codeatlas/types"

// File 04: ticket eligibility mirrors the backend (critical/high/medium;
// low/info not eligible). Bulk mode pre-selects critical + high only.
const TICKET_ELIGIBLE: Severity[] = ["critical", "high", "medium"]
const BULK_PRESELECTED: Severity[] = ["critical", "high"]

const BASE = process.env.NEXT_PUBLIC_API_BASE_URL || (typeof window !== 'undefined' ? window.location.origin : "http://localhost:8000")

const GRADE_COLOR: Record<string, string> = {
  A: "var(--primary)",
  B: "var(--primary)",
  C: "var(--sev-medium)",
  D: "var(--sev-high)",
  F: "var(--sev-critical)",
}

const SEVERITY_ORDER: Severity[] = ["critical", "high", "medium", "low"]

function HealthHeader({ report }: { report: ScanReport }) {
  const color = GRADE_COLOR[report.grade]

const copyBadge = () => {
     const badge = `[![CodeAtlas Health](https://img.shields.io/badge/health-${report.grade}-${report.grade === 'A' ? 'brightgreen' : report.grade === 'B' ? 'green' : report.grade === 'C' ? 'yellow' : report.grade === 'D' ? 'orange' : 'red'})](https://codeatlas.app)`
     navigator.clipboard.writeText(badge).then(() => {
       toast.success("Badge markdown copied")
     }).catch(() => {
       // Fallback: use a temporary textarea
       const textarea = document.createElement("textarea")
       textarea.value = badge
       textarea.style.position = "fixed"
       textarea.style.left = "-9999px"
       document.body.appendChild(textarea)
       textarea.select()
       try {
         document.execCommand("copy")
         toast.success("Badge markdown copied")
       } catch (err) {
         toast.error("Failed to copy badge")
       } finally {
         document.body.removeChild(textarea)
       }
     })
   }

  return (
    <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center gap-4">
          <div className="relative group">
            <div
              className="flex size-16 shrink-0 items-center justify-center rounded-xl font-heading text-3xl font-bold"
              style={{ background: `color-mix(in oklch, ${color} 15%, transparent)`, color }}
            >
              {report.grade}
            </div>
            <button
              onClick={copyBadge}
              className="absolute -top-1 -right-1 flex size-5 items-center justify-center rounded-full border border-border bg-card opacity-0 transition-opacity group-hover:opacity-100 hover:bg-secondary"
              title="Copy badge markdown"
            >
              <Share2 className="size-2.5" />
            </button>
          </div>
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">
            Code Health Score
          </p>
          <p className="font-heading text-2xl font-semibold">
            {report.score}
            <span className="text-base text-muted-foreground">/100</span>
          </p>
          <p className="mt-0.5 text-[12px] leading-snug text-muted-foreground">
            {report.summary}
          </p>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {report.metrics.map((m, i) => (
          <div key={m.label}>
            <div className="mb-1 flex items-center justify-between text-[12px]">
              <span className="text-foreground">{m.label}</span>
              <span className="font-mono text-muted-foreground">{m.value}%</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
              <motion.div
                className="h-full rounded-full bg-primary"
                initial={{ width: 0 }}
                animate={{ width: `${m.value}%` }}
                transition={{ duration: 0.7, delay: 0.1 * i, ease: "easeOut" }}
              />
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground/70">{m.hint}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

function IssueRow({
  issue,
  index,
  ticketCreated,
  creating,
  selected,
  showSelect,
  onToggleSelect,
  onCreate,
}: {
  issue: ScanReport["issues"][number]
  index: number
  ticketCreated: boolean
  creating: boolean
  selected: boolean
  showSelect: boolean
  onToggleSelect: () => void
  onCreate: () => void
}) {
  const [open, setOpen] = useState(false)
  const meta = SEVERITY_META[issue.severity]
  const eligible = (TICKET_ELIGIBLE as string[]).includes(issue.severity)
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      className={`overflow-hidden rounded-lg border border-l-2 border-border bg-card ${meta.border}`}
    >
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left"
      >
        {showSelect && (
          <input
            type="checkbox"
            checked={selected}
            onChange={(e) => {
              e.stopPropagation()
              onToggleSelect()
            }}
            onClick={(e) => e.stopPropagation()}
            aria-label={`Select issue ${issue.title}`}
            className="size-3.5 shrink-0 accent-emerald-500"
          />
        )}
        <span
          className={`rounded px-1.5 py-0.5 text-[10px] font-medium uppercase ${meta.bg} ${meta.text}`}
        >
          {meta.label}
        </span>
        <span className="flex-1 text-[13px] text-card-foreground">
          {issue.title}
        </span>
        {/* Jira/Linear export */}
<div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
  <div
    onClick={() => {
      const linearUrl = `https://linear.new?title=CodeAtlas: ${encodeURIComponent(issue.title)}&description=${encodeURIComponent(`${issue.detail}\n\nFile: ${issue.file}:${issue.line}\n\nFix: ${issue.fix}`)}`
      window.open(linearUrl, '_blank', 'noopener,noreferrer')
    }}
    className="flex size-5 cursor-pointer items-center justify-center rounded text-muted-foreground/50 hover:text-muted-foreground"
    title="Create issue"
    role="button"
    tabIndex={0}
    onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') window.open(`https://linear.new?title=CodeAtlas: ${encodeURIComponent(issue.title)}&description=${encodeURIComponent(`${issue.detail}\n\nFile: ${issue.file}:${issue.line}\n\nFix: ${issue.fix}`)}`, '_blank', 'noopener,noreferrer') }}
  >
    <svg className="size-3" viewBox="0 0 24 24" fill="currentColor"><path d="M3 3h18v18H3V3zm2 2v14h14V5H5zm3 3h8v2H8V8zm0 4h8v2H8v-2zm0 4h5v2H8v-2z"/></svg>
  </div>
</div>
        <ChevronDown
          className={`size-4 shrink-0 text-muted-foreground transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="space-y-2 px-3 pb-3 text-[12px]">
              <p className="font-mono text-[11px] text-muted-foreground">
                {issue.file}:{issue.line}
              </p>
              <p className="leading-relaxed text-muted-foreground">{issue.detail}</p>
              <div className="flex items-start gap-1.5 rounded-md bg-primary/8 px-2 py-1.5 text-primary">
                <Wrench className="mt-0.5 size-3 shrink-0" />
                <span className="leading-relaxed">{issue.fix}</span>
              </div>
              {eligible && (
                <button
                  onClick={onCreate}
                  disabled={ticketCreated || creating}
                  className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5 text-[11px] font-medium text-foreground transition-colors hover:border-primary/40 disabled:cursor-default disabled:opacity-60"
                >
                  {ticketCreated ? (
                    <>
                      <Check className="size-3 text-emerald-500" />
                      Ticket created ✓
                    </>
                  ) : (
                    <>
                      <TicketPlus className="size-3" />
                      {creating ? "Creating…" : "Create ticket"}
                    </>
                  )}
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

function downloadReport(report: ScanReport, format: "csv" | "json" | "txt" | "pdf") {
  const date = new Date().toISOString().split("T")[0]
  const filename = `scan-report-${date}`
  let blob: Blob

  if (format === "pdf") {
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Scan Report</title><style>
      body{font-family:system-ui,sans-serif;max-width:800px;margin:40px auto;padding:0 20px;color:#222}
      h1{font-size:1.5rem;margin-bottom:4px}
      .grade{font-size:2rem;font-weight:700;margin:12px 0 4px}
      .summary{color:#666;margin-bottom:20px}
      h2{font-size:1.1rem;margin:20px 0 8px;border-bottom:1px solid #ddd;padding-bottom:4px}
      .issue{border:1px solid #ddd;border-radius:6px;padding:10px;margin:6px 0}
      .sev{font-size:0.75rem;font-weight:600;text-transform:uppercase;color:#888}
      .file{font-family:monospace;font-size:0.8rem;color:#666}
      .fix{background:#f0fdf4;border-radius:4px;padding:6px;margin-top:6px;font-size:0.85rem}
    </style></head><body>
    <h1>Scan Report</h1>
    <div class="grade">${report.grade} <span style="font-size:1rem;font-weight:400;color:#888">${report.score}/100</span></div>
    <div class="summary">${report.summary}</div>
    <h2>Metrics</h2>
    ${report.metrics.map(m => `<div><strong>${m.label}:</strong> ${m.value}% — ${m.hint}</div>`).join("")}
    <h2>Issues (${report.issues.length})</h2>
    ${report.issues.map(i => `<div class="issue"><div class="sev">${i.severity}</div><strong>${i.title}</strong><div class="file">${i.file}:${i.line}</div><div>${i.detail}</div><div class="fix">Fix: ${i.fix}</div></div>`).join("")}
    <h2>Future Improvements</h2>
    ${report.improvements.map(imp => `<div><strong>${imp.title}</strong><p style="color:#666;margin:4px 0">${imp.detail}</p></div>`).join("")}
    </body></html>`
    const win = window.open("", "_blank")
    if (win) {
      win.document.write(html)
      win.document.close()
      win.focus()
      setTimeout(() => { win.print() }, 500)
    }
    return
  } else if (format === "json") {
    blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" })
  } else if (format === "csv") {
    const header = "severity,file,line,title,detail,fix\n"
    const rows = report.issues
      .map((i) =>
        `"${i.severity}","${i.file}","${i.line}","${i.title.replace(/"/g, '""')}","${i.detail.replace(/"/g, '""')}","${i.fix.replace(/"/g, '""')}"`,
      )
      .join("\n")
    blob = new Blob([header + rows], { type: "text/csv" })
  } else {
    const lines = [
      `Scan Report — ${report.grade} (${report.score}/100)`,
      `Summary: ${report.summary}`,
      "",
      "=== Issues ===",
      ...report.issues.map(
        (i) => `[${i.severity.toUpperCase()}] ${i.file}:${i.line} — ${i.title}\n   ${i.detail}\n   Fix: ${i.fix}`,
      ),
      "",
      "=== Future Improvements ===",
      ...report.improvements.map((imp) => `• ${imp.title}\n  ${imp.detail}`),
    ].join("\n")
    blob = new Blob([lines], { type: "text/plain" })
  }

  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `${filename}.${format}`
  a.click()
  URL.revokeObjectURL(url)
}

function AutoFixSection({ report }: { report: ScanReport }) {
  const { onboardResult } = useCodeAtlas()
  const repoUrl = onboardResult?.sessionId ?? ""
  const [autoFixable, setAutoFixable] = useState<number | null>(null)
  const [fixing, setFixing] = useState(false)
  const [prInfo, setPrInfo] = useState<{ url: string; number: number } | null>(null)
  const [estimating, setEstimating] = useState(false)

  useEffect(() => {
    if (!repoUrl || report.issues.length === 0) return
    setEstimating(true)
    fetch(`${BASE}/autofix/estimate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ repo_url: repoUrl, scan_issues: report.issues }),
    })
      .then(r => r.json())
      .then(d => setAutoFixable(d.auto_fixable))
      .catch(() => {})
      .finally(() => setEstimating(false))
  }, [repoUrl, report.issues])

  const handleGeneratePR = async () => {
    if (!repoUrl) return
    setFixing(true)
    try {
      const resp = await fetch(`${BASE}/autofix/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repo_url: repoUrl, scan_issues: report.issues }),
      })
      const data = await resp.json()
      if (data.error) {
        console.error(data.error)
        setFixing(false)
        return
      }
      const pollId = setInterval(async () => {
        const statusResp = await fetch(`${BASE}/jobs/${data.job_id}/status`)
        const status = await statusResp.json()
        if (status.status === "done" && status.result) {
          clearInterval(pollId)
          setFixing(false)
          if (status.result.pr_url) {
            setPrInfo({ url: status.result.pr_url, number: status.result.pr_number })
          }
        } else if (status.status === "failed") {
          clearInterval(pollId)
          setFixing(false)
        }
      }, 2000)
    } catch {
      setFixing(false)
    }
  }

  if (prInfo) {
    return (
      <motion.a
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        href={prInfo.url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-500 transition-colors hover:bg-emerald-500/20"
      >
        <GitPullRequest className="size-4" />
        PR #{prInfo.number} opened
        <ExternalLink className="size-3 ml-auto" />
      </motion.a>
    )
  }

  if (autoFixable === null || autoFixable === 0) {
    return null
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-4"
    >
      <div className="flex items-center gap-3">
        <span className="flex size-8 items-center justify-center rounded-lg bg-indigo-500/15 text-indigo-400">
          <Sparkles className="size-4" />
        </span>
        <div className="flex-1">
          <p className="text-sm font-medium">Auto-fix available</p>
          <p className="text-xs text-muted-foreground">
            {autoFixable} of {report.issues.length} issues can be auto-fixed
          </p>
        </div>
        <button
          onClick={handleGeneratePR}
          disabled={fixing}
          className="flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-medium text-white transition-all hover:bg-emerald-400 disabled:opacity-50"
        >
          {fixing ? (
            <Loader2 className="size-3 animate-spin" />
          ) : (
            <GitPullRequest className="size-3" />
          )}
          {fixing ? "Generating..." : "Generate Fix PR"}
        </button>
      </div>
    </motion.div>
  )
}


export function ScanTab() {
  const { incrementScanHistoryVersion } = useCodeAtlas()
  const [report, setReport] = useState<ScanReport | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [exportOpen, setExportOpen] = useState(false)
  const exportRef = useRef<HTMLDivElement>(null)
  // File 04: in-app ticket queue state
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [creatingId, setCreatingId] = useState<string | null>(null)
  const [bulkCreating, setBulkCreating] = useState(false)

  const refreshTickets = () => {
    listTickets().then(setTickets).catch(() => {})
  }

  useEffect(() => {
    let active = true
    setError(null)
    fetchScanReport()
      .then((data) => {
        if (active) {
          setReport(data)
          saveScanHistory(data).then(() => {
            incrementScanHistoryVersion()
          }).catch(() => {})
          // Pre-select major (High/Critical) findings for bulk mode
          setSelectedIds(
            data.issues
              .filter((i) => (BULK_PRESELECTED as string[]).includes(i.severity))
              .map((i) => i.id),
          )
        }
      })
      .catch((err) => {
        if (active) setError(err.message)
      })
    refreshTickets()
    return () => {
      active = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incrementScanHistoryVersion])

  const ticketedIds = new Set(tickets.map((t) => t.source_finding_id))

  const describeIssue = (issue: ScanReport["issues"][number]) =>
    `${issue.detail}\n\nFile: ${issue.file}:${issue.line}\n\nSuggested fix: ${issue.fix}`

  const handleCreateTicket = async (issue: ScanReport["issues"][number]) => {
    if (ticketedIds.has(issue.id) || creatingId) return
    setCreatingId(issue.id)
    try {
      const t = await createTicket({
        title: `CodeAtlas: ${issue.title}`,
        description: describeIssue(issue),
        severity: issue.severity,
        source_finding_id: issue.id,
      })
      setTickets((prev) => [...prev, t])
      toast.success("Ticket created ✓")
    } catch {
      toast.error("Failed to create ticket")
    } finally {
      setCreatingId(null)
    }
  }

  const handleBulkCreate = async () => {
    if (!report || bulkCreating) return
    const targets = report.issues.filter(
      (i) => selectedIds.includes(i.id) && !ticketedIds.has(i.id),
    )
    if (targets.length === 0) return
    setBulkCreating(true)
    try {
      // One batch request — no N+1 POST loop (POST /tickets/bulk).
      const res = await createTicketsBulk({
        issues: targets.map((issue) => ({
          title: `CodeAtlas: ${issue.title}`,
          description: describeIssue(issue),
          severity: issue.severity,
          source_finding_id: issue.id,
        })),
      })
      setTickets((prev) => [...prev, ...res.created])
      const createdIds = new Set(res.created.map((t) => t.source_finding_id))
      if (res.count > 0) {
        toast.success(`${res.count} ticket${res.count === 1 ? "" : "s"} created`)
        setSelectedIds((prev) => prev.filter((id) => {
          const issue = targets.find((t) => t.id === id)
          return !issue || !createdIds.has(issue.id)
        }))
      }
      if (res.skipped.length > 0) {
        toast.warning(`${res.skipped.length} finding${res.skipped.length === 1 ? "" : "s"} skipped (ineligible or duplicate)`)
      }
      if (res.count === 0 && res.skipped.length === 0) {
        toast.error("Failed to create tickets")
      }
    } catch {
      toast.error("Failed to create tickets")
    } finally {
      setBulkCreating(false)
    }
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center p-4">
        <div className="flex items-center gap-2 text-sm text-sev-high">
          <AlertCircle className="size-4" />
          {error}
        </div>
      </div>
    )
  }

  if (!report) return <ScanSkeleton />

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Scan Report
        </p>
        <div className="flex items-center gap-1.5">
        <ShareToSlackButton report={report} />
        <div ref={exportRef} className="relative">
          <button
            onClick={() => setExportOpen((o) => !o)}
            className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1 text-[12px] text-foreground transition-colors hover:border-primary/40"
          >
            <Download className="size-3.5" />
            Export
          </button>
          <AnimatePresence>
            {exportOpen && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                className="absolute right-0 top-full z-20 mt-1 w-40 overflow-hidden rounded-lg border border-border bg-card shadow-lg"
              >
                <button
                  onClick={() => { downloadReport(report!, "json"); setExportOpen(false) }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] text-foreground transition-colors hover:bg-secondary"
                >
                  JSON
                </button>
                <button
                  onClick={() => { downloadReport(report!, "csv"); setExportOpen(false) }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] text-foreground transition-colors hover:bg-secondary"
                >
                  CSV
                </button>
                <button
                  onClick={() => { downloadReport(report!, "txt"); setExportOpen(false) }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] text-foreground transition-colors hover:bg-secondary"
                >
                  TXT
                </button>
                <button
                  onClick={() => { downloadReport(report!, "pdf"); setExportOpen(false) }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] text-foreground transition-colors hover:bg-secondary"
                >
                  PDF (Print)
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        </div>
      </div>

      <div className="thin-scroll flex-1 space-y-4 overflow-y-auto p-4">
        <HealthHeader report={report} />

        <AutoFixSection report={report} />

        {report.issues.length === 0 ? (
          <p className="text-[13px] text-card-foreground">
            No issues found — nice.
          </p>
        ) : (
          <div className="space-y-3">
            {(() => {
              const eligible = report.issues.filter((i) =>
                (TICKET_ELIGIBLE as string[]).includes(i.severity),
              )
              const major = report.issues.filter((i) =>
                (BULK_PRESELECTED as string[]).includes(i.severity),
              )
              if (eligible.length === 0) return null
              const allMajorSelected =
                major.length > 0 && major.every((m) => selectedIds.includes(m.id))
              const pendingSelected = selectedIds.filter(
                (id) => !ticketedIds.has(id),
              ).length
              return (
                <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-2.5">
                  <label className="flex flex-1 cursor-pointer items-center gap-2 text-[12px] text-foreground">
                    <input
                      type="checkbox"
                      checked={allMajorSelected}
                      onChange={() => {
                        setSelectedIds(
                          allMajorSelected ? [] : major.map((m) => m.id),
                        )
                      }}
                      className="size-3.5 accent-emerald-500"
                    />
                    Select all major issues ({major.length})
                  </label>
                  <button
                    onClick={handleBulkCreate}
                    disabled={pendingSelected === 0 || bulkCreating}
                    className="rounded-lg bg-primary px-3 py-1.5 text-[12px] font-medium text-primary-foreground transition-opacity disabled:opacity-40"
                  >
                    {bulkCreating
                      ? "Creating…"
                      : `Create ${pendingSelected} ticket${pendingSelected === 1 ? "" : "s"}`}
                  </button>
                </div>
              )
            })()}
            {SEVERITY_ORDER.map((sev) => {
              const items = report.issues.filter((i) => i.severity === sev)
              if (items.length === 0) return null
              return (
                <div key={sev} className="space-y-1.5">
                  <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                    <span
                      className="size-2 rounded-full"
                      style={{ background: SEVERITY_META[sev].color }}
                    />
                    {SEVERITY_META[sev].label} · {items.length}
                  </p>
                  {items.map((issue, i) => (
                    <IssueRow
                      key={issue.id}
                      issue={issue}
                      index={i}
                      ticketCreated={ticketedIds.has(issue.id)}
                      creating={creatingId === issue.id}
                      selected={selectedIds.includes(issue.id)}
                      showSelect={(TICKET_ELIGIBLE as string[]).includes(issue.severity)}
                      onToggleSelect={() =>
                        setSelectedIds((prev) =>
                          prev.includes(issue.id)
                            ? prev.filter((id) => id !== issue.id)
                            : [...prev, issue.id],
                        )
                      }
                      onCreate={() => handleCreateTicket(issue)}
                    />
                  ))}
                </div>
              )
            })}
          </div>
        )}

        <div className="rounded-xl border border-border bg-card p-4">
          <p className="mb-3 flex items-center gap-1.5 text-[13px] font-medium">
            <Lightbulb className="size-4 text-primary" />
            Future Improvements
          </p>
          <div className="space-y-2.5">
            {report.improvements.map((imp) => (
              <div key={imp.id} className="flex gap-2.5">
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
                <div>
                  <p className="text-[13px] text-card-foreground">{imp.title}</p>
                  <p className="text-[12px] leading-snug text-muted-foreground">
                    {imp.detail}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
