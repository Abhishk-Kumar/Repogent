"use client"

import { AnimatePresence, motion } from "motion/react"
import { ArrowUp, Compass } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { sendChatMessage, getSessionId } from "@/lib/codeatlas/api"
import { useCodeAtlas } from "@/lib/codeatlas/context"
import type { ChatMessage } from "@/lib/codeatlas/types"

const SUGGESTIONS = [
  "What does this project do?",
  "How is the code structured?",
  "What are the main technologies used?",
]

function renderContent(text: string) {
  if (!text || !text.trim()) {
    return <span className="italic text-muted-foreground/60">No response</span>
  }
  const segments = text.split(/(`[^`]+`)/g)
  return segments.map((part, i) =>
    part.startsWith("`") && part.endsWith("`") ? (
      <code
        key={i}
        className="rounded bg-background/60 px-1 py-0.5 font-mono text-[12px] text-primary break-all"
      >
        {part.slice(1, -1)}
      </code>
    ) : (
      <span key={i} className="break-words">{part}</span>
    ),
  )
}

function Avatar() {
  return (
    <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary/12 text-primary">
      <Compass className="size-4" />
    </span>
  )
}

function TypingDots() {
  return (
    <div className="flex items-center gap-1 rounded-2xl rounded-tl-sm border border-border bg-card px-3 py-3">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="size-1.5 rounded-full bg-muted-foreground"
          animate={{ y: [0, -4, 0], opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15 }}
        />
      ))}
    </div>
  )
}

const SEED_MESSAGE: ChatMessage = {
  id: "seed",
  role: "assistant" as const,
  content:
    "I've analyzed the repository. Ask me anything about how the code fits together.",
}

function readStoredMessages(sessionId: string): ChatMessage[] {
  if (!sessionId || typeof window === "undefined") return []
  try {
    const stored = localStorage.getItem(`chat_history_${sessionId}`)
    if (!stored) return []
    const parsed = JSON.parse(stored)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((m: ChatMessage) => m?.id !== "seed" && typeof m?.content === "string")
  } catch {
    return []
  }
}

export function ChatTab() {
  const { onboardResult } = useCodeAtlas()
  const sessionId = onboardResult?.sessionId ?? getSessionId() ?? ""
  const hasSession = !!sessionId

  const [messages, setMessages] = useState<ChatMessage[]>([SEED_MESSAGE])

  // Load persisted history when session changes (refresh-safe)
  useEffect(() => {
    if (!sessionId) {
      setMessages([])
      return
    }
    setMessages([SEED_MESSAGE, ...readStoredMessages(sessionId)])
  }, [sessionId])

  // Persist messages whenever they change (excluding the seed message)
  useEffect(() => {
    if (!sessionId || typeof window === "undefined") return
    try {
      const toStore = messages.filter((m) => m.id !== "seed")
      localStorage.setItem(`chat_history_${sessionId}`, JSON.stringify(toStore))
    } catch {}
  }, [messages, sessionId])
  const [input, setInput] = useState("")
  const [thinking, setThinking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastFailed, setLastFailed] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    })
  }, [messages, thinking])

  async function send(text: string) {
    const value = text.trim()
    if (!value || thinking) return
    if (!getSessionId()) return
    
    // Cancel any ongoing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    
    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: "user",
      content: value,
    }
    const next = [...messages, userMsg]
    setMessages(next)
    setInput("")
    setThinking(true)
    setError(null)
    
    // Create new abort controller for this request (60s turn timeout per 03.2)
    abortControllerRef.current = new AbortController()
    const timeoutId = setTimeout(() => abortControllerRef.current?.abort(), 60_000)

    try {
      const reply = await sendChatMessage(next, value, abortControllerRef.current.signal)
      clearTimeout(timeoutId)
      setLastFailed(null)
      setMessages((prev) => [
        ...prev,
        { id: `a-${Date.now()}`, role: "assistant", content: reply },
      ])
    } catch (err: any) {
      clearTimeout(timeoutId)
      if (err.name === "AbortError") {
        setMessages((prev) => [
          ...prev,
          {
            id: `a-${Date.now()}`,
            role: "assistant",
            content: "Request timed out — Retry",
          },
        ])
        setError("timeout")
        setLastFailed(value)
        return
      }
      if (err.message === "chat_unavailable") {
        setLastFailed(value)
        setMessages((prev) => [
          ...prev,
          {
            id: `a-${Date.now()}`,
            role: "assistant",
            content:
              "Couldn't reach the AI — Retry",
          },
        ])
        setError("chat_unavailable")
      } else {
        setMessages((prev) => [
          ...prev,
          {
            id: `a-${Date.now()}`,
            role: "assistant",
            content:
              "Sorry, I encountered an error. Make sure a repository is onboarded and try again.",
          },
        ])
      }
    } finally {
      setThinking(false)
      abortControllerRef.current = null
    }
  }

  if (!hasSession) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
        <span className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Compass className="size-6" />
        </span>
        <h3 className="text-base font-semibold">No repository loaded</h3>
        <p className="max-w-xs text-sm text-muted-foreground">
          Onboard a repository from the home page to start asking questions about the code.
        </p>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <div ref={scrollRef} className="thin-scroll flex-1 space-y-4 overflow-y-auto p-4">
        {messages.map((m) => (
          <motion.div
            key={m.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28 }}
            className={`flex gap-2 ${
              m.role === "user" ? "justify-end" : "justify-start"
            }`}
          >
            {m.role === "assistant" && <Avatar />}
            <div
              className={`max-w-[78%] text-[13px] leading-relaxed break-words [overflow-wrap:break-word] ${
                m.role === "user"
                  ? "rounded-2xl rounded-tr-sm bg-primary px-3 py-2 text-primary-foreground"
                  : "rounded-2xl rounded-tl-sm border border-border bg-card px-3 py-2 text-card-foreground"
              }`}
            >
              {renderContent(m.content)}
            </div>
          </motion.div>
        ))}

        <AnimatePresence>
          {thinking && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex gap-2"
            >
              <Avatar />
              <TypingDots />
            </motion.div>
          )}
        </AnimatePresence>

        {(error === "chat_unavailable" || error === "timeout") && lastFailed && !thinking && (
          <div className="px-4 pb-2">
            <div className="flex items-center gap-2 rounded-xl border border-orange-500/30 bg-orange-500/10 px-3 py-2">
              <p className="flex-1 text-[12px] text-orange-500">
                {error === "timeout" ? "Request timed out." : "Couldn't reach the AI."}
              </p>
              <button
                onClick={() => send(lastFailed)}
                className="rounded-lg bg-primary px-2.5 py-1 text-[11px] font-medium text-primary-foreground transition-opacity hover:opacity-90"
              >
                Retry
              </button>
            </div>
          </div>
        )}
      </div>

      {messages.length <= 1 && hasSession && (
        <div className="flex flex-wrap gap-1.5 px-4 pb-2">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => send(s)}
              className="rounded-full border border-border bg-card px-2.5 py-1 text-[11px] text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
            >
              {s}
            </button>
          ))}
        </div>
      )}

<form
  onSubmit={(e) => {
    e.preventDefault()
    send(input)
  }}
  className="border-t border-border p-3"
>
  <div className="flex items-end gap-2 rounded-xl border border-border bg-card px-3 py-2 focus-within:border-primary/50">
    <textarea
      value={input}
      onChange={(e) => setInput(e.target.value)}
      placeholder="Ask about this repository…"
      className="flex-1 min-h-[44px] resize-none bg-transparent text-[13px] text-foreground outline-none placeholder:text-muted-foreground/70"
      onKeyDown={(e) => {
        // Handle Enter for sending, Shift+Enter for newline
        if (e.key === "Enter") {
          if (e.shiftKey) {
            // Allow Shift+Enter for newline
            return
          }
          // Prevent default form submission for Enter (we'll handle it manually)
          e.preventDefault()
          send(input)
        }
      }}
    />
    <button
      type="submit"
      disabled={!input.trim() || thinking || !hasSession}
      aria-label="Send message"
      className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-opacity disabled:opacity-40"
    >
      <ArrowUp className="size-4" strokeWidth={2.5} />
    </button>
  </div>
</form>
    </div>
  )
}
