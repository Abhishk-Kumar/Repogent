"use client"

import { createContext, useContext, useEffect, useRef, useState, useCallback } from "react"

export type BackendState = "idle" | "waking" | "ready" | "failed"

interface BackendStatusContextValue {
  state: BackendState
  elapsedSeconds: number
  warmUp: () => Promise<void>
  apiFetch: <T>(path: string, options?: RequestInit) => Promise<T>
}

const BackendStatusContext = createContext<BackendStatusContextValue | null>(null)

const MAX_WAKE_TIME = 90_000
const REQUEST_TIMEOUT = 20_000
const RETRY_BASE_DELAY = 1_000
const MAX_RETRIES = 5

function getApiBase(): string {
  const envBase = process.env.NEXT_PUBLIC_API_BASE_URL
  if (envBase) {
    return envBase.replace(/\/+$/, "")
  }
  if (typeof window !== "undefined") {
    const isLocalhost = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
    if (isLocalhost) {
      return "http://localhost:8000"
    }
    console.error(
      "[CodeAtlas] NEXT_PUBLIC_API_BASE_URL not set. Falling back to window.location.origin. " +
        "In production, this must be set to your Render backend URL."
    )
    return window.location.origin
  }
  return "http://localhost:8000"
}

export const API_BASE = getApiBase()

async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...options, signal: controller.signal })
  } finally {
    clearTimeout(timeoutId)
  }
}

function isRetryableError(error: unknown): boolean {
  if (error instanceof DOMException && error.name === "AbortError") return true
  if (error instanceof TypeError && error.message.includes("fetch")) return true
  if (error instanceof Response) {
    const status = error.status
    return status === 502 || status === 503 || status === 504
  }
  return false
}

async function fetchWithRetry<T>(
  path: string,
  options: RequestInit,
  onStateChange?: (state: BackendState, elapsed: number) => void,
  startTime?: number
): Promise<T> {
  let lastError: unknown
  let attempt = 0
  const start = startTime ?? Date.now()

  while (attempt <= MAX_RETRIES) {
    const elapsed = Date.now() - start
    if (elapsed >= MAX_WAKE_TIME) {
      break
    }

    try {
      const res = await fetchWithTimeout(`${API_BASE}${path}`, options, REQUEST_TIMEOUT)
      
      if (res.status === 404) {
        const text = await res.text().catch(() => "")
        if (text.includes("session not found") || text.includes("Session not found")) {
          throw new Error("SESSION_EXPIRED")
        }
      }

      if (!res.ok) {
        if (res.status === 502 || res.status === 503 || res.status === 504) {
          throw res
        }
        const text = await res.text().catch(() => "")
        throw new Error(`${res.status}: ${text}`)
      }

      return res.json() as Promise<T>
    } catch (err) {
      lastError = err
      
      if (err instanceof Error && err.message === "SESSION_EXPIRED") {
        throw err
      }

      if (!isRetryableError(err)) {
        throw err
      }

      if (attempt === 0 && onStateChange) {
        onStateChange("waking", elapsed)
      }

      const delay = Math.min(RETRY_BASE_DELAY * Math.pow(2, attempt), 10_000)
      await new Promise((resolve) => setTimeout(resolve, delay))
      attempt++
    }
  }

  if (onStateChange) {
    onStateChange("failed", Date.now() - start)
  }
  throw lastError
}

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  return fetchWithRetry<T>(path, options)
}

export function BackendStatusProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<BackendState>("idle")
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const startTimeRef = useRef<number>(0)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const mountedRef = useRef(true)

  const updateState = useCallback((newState: BackendState, elapsed: number) => {
    if (!mountedRef.current) return
    setState(newState)
    setElapsedSeconds(Math.round(elapsed / 1000))
  }, [])

  const warmUp = useCallback(async () => {
    if (state === "ready" || state === "waking") return
    
    startTimeRef.current = Date.now()
    mountedRef.current = true
    setState("waking")
    setElapsedSeconds(0)

    if (intervalRef.current) clearInterval(intervalRef.current)
    intervalRef.current = setInterval(() => {
      if (mountedRef.current) {
        setElapsedSeconds(Math.round((Date.now() - startTimeRef.current) / 1000))
      }
    }, 1000)

    try {
      await fetchWithTimeout(`${API_BASE}/health`, { method: "GET" }, REQUEST_TIMEOUT)
      if (mountedRef.current) {
        setState("ready")
        setTimeout(() => {
          if (mountedRef.current) {
            setState("idle")
          }
        }, 2000)
      }
    } catch {
      if (mountedRef.current) {
        setState("idle")
      }
    } finally {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [state])

  const contextualApiFetch = useCallback(
    async (path: string, options: RequestInit = {}): Promise<any> => {
      const start = Date.now()
      return fetchWithRetry(path, options, updateState, start)
    },
    [updateState]
  )

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [])

  return (
    <BackendStatusContext.Provider value={{ state, elapsedSeconds, warmUp, apiFetch: contextualApiFetch }}>
      {children}
    </BackendStatusContext.Provider>
  )
}

export function useBackendStatus() {
  const ctx = useContext(BackendStatusContext)
  if (!ctx) {
    throw new Error("useBackendStatus must be used within BackendStatusProvider")
  }
  return ctx
}

export async function serverFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const base = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/+$/, "") ?? "http://localhost:8000"
  const res = await fetch(`${base}${path}`, { ...options, headers: { "Content-Type": "application/json", ...options.headers } })
  if (!res.ok) {
    const text = await res.text().catch(() => "")
    throw new Error(`${res.status}: ${text}`)
  }
  return res.json()
}

export class SessionExpiredError extends Error {
  constructor() {
    super("SESSION_EXPIRED")
    this.name = "SessionExpiredError"
  }
}

export function isSessionExpiredError(error: unknown): error is SessionExpiredError {
  return error instanceof SessionExpiredError || (error instanceof Error && error.message === "SESSION_EXPIRED")
}