"use client"

import { AnimatePresence, motion } from "motion/react"
import { FileSearch, MessagesSquare, ScrollText, Activity, Ticket, Settings, Key, Copy, Trash2, Plus } from "lucide-react"
import { useState } from "react"
import { ChatTab } from "./chat-tab"
import { ScanTab } from "./scan-tab"
import { ExplainTab } from "./explain-tab"
import { HistoryTab } from "./history-tab"
import { TicketsTab } from "./tickets-tab"
import { SettingsTab } from "./settings-tab"

const TABS = [
  { id: "chat", label: "Chat", icon: MessagesSquare },
  { id: "scan", label: "Scan Report", icon: FileSearch },
  { id: "explain", label: "Explain Repo", icon: ScrollText },
  { id: "history", label: "History", icon: Activity },
  { id: "tickets", label: "Tickets", icon: Ticket },
  { id: "settings", label: "Settings", icon: Settings },
] as const

type TabId = (typeof TABS)[number]["id"]

export function RightPanel() {
  const [tab, setTab] = useState<TabId>("chat")

  return (
    <div className="flex h-full flex-col">
      {/* tab bar */}
      <div className="flex shrink-0 gap-1 border-b border-border p-1.5">
        {TABS.map((t) => {
          const active = tab === t.id
          const Icon = t.icon
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`relative flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-[12px] font-medium transition-colors ${
                active
                  ? "text-black"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {active && (
                <motion.span
                  layoutId="tab-pill"
                  className="absolute inset-0 rounded-lg bg-[#34d399]"
                  transition={{ type: "spring", stiffness: 380, damping: 30 }}
                />
              )}
              <span className="relative flex items-center gap-1.5">
                <Icon className="size-3.5" />
                {t.label}
              </span>
            </button>
          )
        })}
      </div>

      {/* tab content */}
      <div className="relative flex-1 overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -12 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0"
          >
            {tab === "chat" && <ChatTab />}
            {tab === "scan" && <ScanTab />}
            {tab === "explain" && <ExplainTab />}
            {tab === "history" && <HistoryTab />}
            {tab === "tickets" && <TicketsTab />}
            {tab === "settings" && <SettingsTab />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}
