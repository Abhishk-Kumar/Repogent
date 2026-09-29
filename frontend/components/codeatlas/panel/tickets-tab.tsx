"use client"

import { useCallback, useEffect, useState } from "react"
import { motion } from "motion/react"
import { ExternalLink, Loader2, Ticket as TicketIcon, Trash2 } from "lucide-react"
import { toast } from "sonner"
import {
  deleteTicket,
  disconnectJira,
  fetchJiraConnect,
  fetchJiraStatus,
  listTickets,
  pushTicketToJira,
} from "@/lib/codeatlas/api"
import { SEVERITY_META } from "../style-maps"
import type { JiraStatus, Ticket } from "@/lib/codeatlas/types"

export function TicketsTab() {
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [jira, setJira] = useState<JiraStatus>({ connected: false })
  const [pushingId, setPushingId] = useState<number | null>(null)
  const [pushingAll, setPushingAll] = useState(false)

  const refresh = useCallback(() => {
    listTickets().then(setTickets).catch(() => {})
    fetchJiraStatus().then(setJira).catch(() => {})
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const handleDelete = async (id: number) => {
    try {
      await deleteTicket(id)
      setTickets((prev) => prev.filter((t) => t.id !== id))
      toast.success("Ticket deleted")
    } catch {
      toast.error("Failed to delete ticket")
    }
  }

  const handlePush = async (id: number) => {
    setPushingId(id)
    try {
      const res = await pushTicketToJira(id)
      if (res.error) {
        toast.error(
          res.error === "jira_not_connected"
            ? "Connect Jira first"
            : "Push to Jira failed",
        )
      } else {
        toast.success(`Pushed as ${res.issue_key}`)
        refresh()
      }
    } catch {
      toast.error("Push to Jira failed")
    } finally {
      setPushingId(null)
    }
  }

  const handlePushAll = async () => {
    const open = tickets.filter((t) => t.status === "open")
    if (open.length === 0) return
    setPushingAll(true)
    let pushed = 0
    for (const t of open) {
      try {
        const res = await pushTicketToJira(t.id)
        if (!res.error) pushed++
      } catch {}
    }
    setPushingAll(false)
    toast.success(pushed > 0 ? `Pushed ${pushed} ticket${pushed === 1 ? "" : "s"}` : "Push failed")
    refresh()
  }

  const handleConnect = async () => {
    try {
      const res = await fetchJiraConnect()
      if (res.auth_url) {
        window.open(res.auth_url, "_blank", "noopener,noreferrer")
      } else {
        toast.error("Jira OAuth not configured on the server")
      }
    } catch {
      toast.error("Could not start Jira OAuth")
    }
  }

  const handleDisconnect = async () => {
    try {
      await disconnectJira()
      setJira({ connected: false })
      toast.success("Jira disconnected")
    } catch {
      toast.error("Failed to disconnect Jira")
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Tickets · {tickets.length}
        </p>
        {jira.connected ? (
          <button
            onClick={handleDisconnect}
            className="rounded-lg border border-border px-2.5 py-1 text-[12px] text-muted-foreground transition-colors hover:text-foreground"
            title={jira.site_name ? `Connected: ${jira.site_name}` : "Connected"}
          >
            {jira.site_name ? `Jira: ${jira.site_name} · Disconnect` : "Disconnect Jira"}
          </button>
        ) : (
          <button
            onClick={handleConnect}
            className="rounded-lg bg-primary px-2.5 py-1 text-[12px] font-medium text-primary-foreground"
          >
            Connect Jira
          </button>
        )}
      </div>

      <div className="thin-scroll flex-1 space-y-2 overflow-y-auto p-4">
        {tickets.length > 0 && (
          <button
            onClick={handlePushAll}
            disabled={pushingAll || tickets.every((t) => t.status === "pushed")}
            className="w-full rounded-lg bg-primary px-3 py-2 text-[12px] font-medium text-primary-foreground transition-opacity disabled:opacity-40"
          >
            {pushingAll ? "Pushing…" : "Push all to Jira"}
          </button>
        )}

        {tickets.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
            <TicketIcon className="size-8 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">No tickets yet</p>
            <p className="text-xs text-muted-foreground/60">
              Create tickets from scan findings — they persist here across refreshes.
            </p>
          </div>
        ) : (
          tickets.map((t, i) => {
            const meta = SEVERITY_META[t.severity as keyof typeof SEVERITY_META]
            return (
              <motion.div
                key={t.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                className="rounded-lg border border-border bg-card p-3"
              >
                <div className="flex items-center gap-2">
                  {meta && (
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] font-medium uppercase ${meta.bg} ${meta.text}`}
                    >
                      {meta.label}
                    </span>
                  )}
                  <span
                    className={`rounded px-1.5 py-0.5 text-[10px] font-medium uppercase ${
                      t.status === "pushed"
                        ? "bg-emerald-500/15 text-emerald-500"
                        : "bg-secondary text-muted-foreground"
                    }`}
                  >
                    {t.status}
                  </span>
                  <button
                    onClick={() => handleDelete(t.id)}
                    className="ml-auto flex size-6 items-center justify-center rounded text-muted-foreground/60 transition-colors hover:text-sev-high"
                    aria-label={`Delete ticket ${t.title}`}
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
                <p className="mt-2 text-[13px] font-medium text-card-foreground">{t.title}</p>
                <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                  {t.repo} · {new Date(t.created_at).toLocaleDateString()}
                </p>
                <div className="mt-2 flex items-center gap-2">
                  {t.status === "pushed" && t.jira_url ? (
                    <a
                      href={t.jira_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-[12px] text-primary hover:underline"
                    >
                      {t.jira_issue_key} <ExternalLink className="size-3" />
                    </a>
                  ) : (
                    <button
                      onClick={() => handlePush(t.id)}
                      disabled={pushingId === t.id}
                      className="flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1 text-[11px] font-medium transition-colors hover:border-primary/40 disabled:opacity-50"
                    >
                      {pushingId === t.id && <Loader2 className="size-3 animate-spin" />}
                      {pushingId === t.id ? "Pushing…" : "Push to Jira"}
                    </button>
                  )}
                </div>
              </motion.div>
            )
          })
        )}
      </div>
    </div>
  )
}
