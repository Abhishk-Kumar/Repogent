"use client"

import { AnimatePresence, motion } from "motion/react"
import { Check, Loader2, Share2 } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import {
  disconnectSlack,
  fetchSlackChannels,
  fetchSlackConnect,
  fetchSlackStatus,
  saveSlackWebhook,
  setSlackNotify,
  shareScanToSlack,
  shareScanViaWebhook,
} from "@/lib/codeatlas/api"
import { useCodeAtlas } from "@/lib/codeatlas/context"
import type { ScanReport, SlackChannel, SlackStatus } from "@/lib/codeatlas/types"

// File 06: Slack sharing + notifications. Scoped: no bot commands.
// Mirrors the Jira connect-button pattern in top-bar.tsx.

export function SlackConnectButton() {
  const [status, setStatus] = useState<SlackStatus>({ connected: false })

  useEffect(() => {
    fetchSlackStatus().then(setStatus).catch(() => {})
  }, [])

  if (status.connected) {
    return (
      <span
        className="hidden items-center gap-1 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1.5 text-xs text-emerald-500 md:flex"
        title={status.team_name ? `Slack connected: ${status.team_name}` : "Slack connected"}
      >
        <Check className="size-3" />
        Slack{status.team_name ? `: ${status.team_name}` : ""}
      </span>
    )
  }

  return (
    <button
      onClick={() =>
        fetchSlackConnect()
          .then((r) => {
            if (r.auth_url) {
              window.open(r.auth_url, "_blank", "noopener,noreferrer")
            } else {
              toast.error(r.detail || "Slack OAuth not configured on the server")
            }
          })
          .catch(() => toast.error("Could not start Slack OAuth"))
      }
      className="hidden items-center gap-1 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground md:flex"
    >
      Connect Slack
    </button>
  )
}

export function ShareToSlackButton({ report }: { report: ScanReport }) {
  const { onboardResult } = useCodeAtlas()
  const [open, setOpen] = useState(false)
  const [status, setStatus] = useState<SlackStatus>({ connected: false })
  const [channels, setChannels] = useState<SlackChannel[]>([])
  const [channel, setChannel] = useState("")
  const [loading, setLoading] = useState(false)
  const [sharing, setSharing] = useState(false)
  const [webhook, setWebhook] = useState("")
  const ref = useRef<HTMLDivElement>(null)

  const repo = onboardResult?.sessionId ?? ""

  const refresh = () => {
    fetchSlackStatus()
      .then((s) => {
        setStatus(s)
        if (s.connected) {
          fetchSlackChannels()
            .then((r) => {
              if (r.channels) {
                setChannels(r.channels)
                const firstMember = r.channels.find((c) => c.is_member)
                setChannel((prev) => prev || firstMember?.id || r.channels![0]?.id || "")
              }
            })
            .catch(() => {})
        }
      })
      .catch(() => {})
  }

  useEffect(() => {
    if (open) refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open ])

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", onDown)
    return () => document.removeEventListener("mousedown", onDown)
  }, [])

  const findings = report.issues.map((i) => ({ severity: i.severity, title: i.title }))
  const reportUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/workspace?repo=${encodeURIComponent(repo)}`
      : ""

  const doShareOAuth = async () => {
    if (!channel) {
      toast.error("Pick a channel first")
      return
    }
    setSharing(true)
    try {
      const res = await shareScanToSlack({
        repo,
        channel,
        health_score: report.score,
        grade: report.grade,
        findings,
        report_url: reportUrl,
      })
      if (res.ok) {
        toast.success("Shared to Slack ✓")
        setOpen(false)
      } else {
        toast.error(res.detail || "Share to Slack failed")
      }
    } catch {
      toast.error("Share to Slack failed")
    } finally {
      setSharing(false)
    }
  }

  const doShareWebhook = async () => {
    setSharing(true)
    try {
      const res = await shareScanViaWebhook({
        repo,
        health_score: report.score,
        grade: report.grade,
        findings,
        report_url: reportUrl,
        webhook_url: webhook.trim() || undefined,
      })
      if (res.ok) {
        toast.success("Shared to Slack ✓")
        setOpen(false)
      } else {
        toast.error(res.detail || "Share via webhook failed")
      }
    } catch {
      toast.error("Share via webhook failed")
    } finally {
      setSharing(false)
    }
  }

  const doSaveWebhook = async () => {
    if (!webhook.trim().startsWith("https://hooks.slack.com/")) {
      toast.error("Expected an https://hooks.slack.com/ URL")
      return
    }
    setLoading(true)
    try {
      const res = await saveSlackWebhook(webhook.trim())
      if (res.ok) {
        toast.success("Webhook saved")
        refresh()
      } else {
        toast.error(res.detail || "Could not save webhook")
      }
    } catch {
      toast.error("Could not save webhook")
    } finally {
      setLoading(false)
    }
  }

  const toggleNotify = async (enabled: boolean) => {
    try {
      const res = await setSlackNotify(enabled)
      if (res.notify_on_complete !== undefined) {
        setStatus((s) => ({ ...s, notify_on_complete: res.notify_on_complete }))
        toast.success(enabled ? "Slack notifications on" : "Slack notifications off")
      } else {
        toast.error(res.detail || "Could not update notification preference")
      }
    } catch {
      toast.error("Could not update notification preference")
    }
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1 text-[12px] text-foreground transition-colors hover:border-primary/40"
      >
        <Share2 className="size-3.5" />
        Share to Slack
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="absolute right-0 top-full z-20 mt-1 w-72 space-y-3 rounded-lg border border-border bg-card p-3 shadow-lg"
          >
            {status.connected ? (
              <>
                <div className="flex items-center justify-between">
                  <p className="text-[12px] font-medium text-foreground">
                    {status.team_name ? `Slack: ${status.team_name}` : "Slack connected"}
                  </p>
                  <button
                    onClick={() =>
                      disconnectSlack()
                        .then(() => {
                          setStatus({ connected: false })
                          setChannels([])
                          toast.success("Slack disconnected")
                        })
                        .catch(() => toast.error("Failed to disconnect Slack"))
                    }
                    className="text-[11px] text-muted-foreground hover:text-foreground"
                  >
                    Disconnect
                  </button>
                </div>
                <label className="block">
                  <span className="mb-1 block text-[11px] uppercase tracking-wider text-muted-foreground">
                    Channel
                  </span>
                  <select
                    value={channel}
                    onChange={(e) => setChannel(e.target.value)}
                    className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-[12px] text-foreground"
                  >
                    {channels.length === 0 && <option value="">Loading…</option>}
                    {channels.map((c) => (
                      <option key={c.id} value={c.id}>
                        #{c.name}
                        {c.is_private ? " (private)" : ""}
                        {c.is_member ? "" : " — bot not in channel"}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  onClick={doShareOAuth}
                  disabled={sharing || !channel}
                  className="flex w-full items-center justify-center gap-1.5 rounded-md bg-primary px-2 py-1.5 text-[12px] font-medium text-primary-foreground disabled:opacity-50"
                >
                  {sharing && <Loader2 className="size-3 animate-spin" />}
                  {sharing ? "Sharing…" : "Share scan summary"}
                </button>
                <label className="flex cursor-pointer items-center justify-between gap-2 text-[12px] text-foreground">
                  <span>Notify me when scans complete</span>
                  <input
                    type="checkbox"
                    checked={!!status.notify_on_complete}
                    onChange={(e) => toggleNotify(e.target.checked)}
                    className="size-3.5 accent-emerald-500"
                  />
                </label>
              </>
            ) : (
              <>
                <p className="text-[12px] leading-snug text-muted-foreground">
                  Connect Slack with OAuth, or paste an incoming-webhook URL as a
                  fallback (06.2).
                </p>
                <button
                  onClick={() =>
                    fetchSlackConnect()
                      .then((r) => {
                        if (r.auth_url) {
                          window.open(r.auth_url, "_blank", "noopener,noreferrer")
                        } else {
                          toast.error(r.detail || "Slack OAuth not configured on the server")
                        }
                      })
                      .catch(() => toast.error("Could not start Slack OAuth"))
                  }
                  className="w-full rounded-md border border-border bg-secondary px-2 py-1.5 text-[12px] text-foreground hover:border-primary/40"
                >
                  Connect Slack with OAuth
                </button>
                <div className="space-y-1.5">
                  <span className="block text-[11px] uppercase tracking-wider text-muted-foreground">
                    …or incoming webhook URL
                  </span>
                  <input
                    value={webhook}
                    onChange={(e) => setWebhook(e.target.value)}
                    placeholder="https://hooks.slack.com/…"
                    spellCheck={false}
                    className="w-full rounded-md border border-border bg-background px-2 py-1.5 font-mono text-[11px] text-foreground placeholder:text-muted-foreground/50"
                  />
                  <div className="flex gap-1.5">
                    <button
                      onClick={doSaveWebhook}
                      disabled={loading}
                      className="flex-1 rounded-md border border-border px-2 py-1.5 text-[12px] text-foreground hover:border-primary/40 disabled:opacity-50"
                    >
                      {loading ? "Saving…" : "Save webhook"}
                    </button>
                    <button
                      onClick={doShareWebhook}
                      disabled={sharing}
                      className="flex flex-1 items-center justify-center gap-1 rounded-md bg-primary px-2 py-1.5 text-[12px] font-medium text-primary-foreground disabled:opacity-50"
                    >
                      {sharing && <Loader2 className="size-3 animate-spin" />}
                      {sharing ? "Sharing…" : "Share via webhook"}
                    </button>
                  </div>
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
