"use client"

import { createContext, useCallback, useContext, useMemo, useState } from "react"
import type { RepoGraph, ScanReport, ExplainPoint } from "./types"

export interface OnboardResult {
  sessionId: string
  graph: RepoGraph
  fileList: string[]
}

export interface JobProgress {
  message: string
  current: number
  total: number
  status: "pending" | "running" | "done" | "failed"
  error?: string
}

interface CodeAtlasState {
  onboardResult: OnboardResult | null
  setOnboardResult: (r: OnboardResult) => void
  scanReport: ScanReport | null
  setScanReport: (r: ScanReport) => void
  explainPoints: ExplainPoint[] | null
  setExplainPoints: (r: ExplainPoint[]) => void
  jobProgress: JobProgress | null
  setJobProgress: (p: JobProgress | null) => void
  scanHistoryVersion: number
  incrementScanHistoryVersion: () => void
}

const CodeAtlasCtx = createContext<CodeAtlasState | null>(null)

const globalStore: {
  onboardResult: OnboardResult | null
  scanReport: ScanReport | null
  explainPoints: ExplainPoint[] | null
  jobProgress: JobProgress | null
  scanHistoryVersion: number
} = {
  onboardResult: null,
  scanReport: null,
  explainPoints: null,
  jobProgress: null,
  scanHistoryVersion: 0,
}

export function CodeAtlasProvider({ children }: { children: React.ReactNode }) {
  const [onboardResult, setOnboardResultState] = useState<OnboardResult | null>(globalStore.onboardResult)
  const [scanReport, setScanReportState] = useState<ScanReport | null>(globalStore.scanReport)
  const [explainPoints, setExplainPointsState] = useState<ExplainPoint[] | null>(globalStore.explainPoints)
  const [jobProgress, setJobProgressState] = useState<JobProgress | null>(globalStore.jobProgress)
  const [scanHistoryVersion, setScanHistoryVersion] = useState<number>(globalStore.scanHistoryVersion)

  const incrementScanHistoryVersion = useCallback(() => {
    const next = globalStore.scanHistoryVersion + 1
    globalStore.scanHistoryVersion = next
    setScanHistoryVersion(next)
  }, [])

  const value = useMemo(
    () => ({
      onboardResult,
      setOnboardResult: (r: OnboardResult) => {
        globalStore.onboardResult = r
        setOnboardResultState(r)
      },
      scanReport,
      setScanReport: (r: ScanReport) => {
        globalStore.scanReport = r
        setScanReportState(r)
      },
      explainPoints,
      setExplainPoints: (r: ExplainPoint[]) => {
        globalStore.explainPoints = r
        setExplainPointsState(r)
      },
      jobProgress,
      setJobProgress: (p: JobProgress | null) => {
        globalStore.jobProgress = p
        setJobProgressState(p)
      },
      scanHistoryVersion,
      incrementScanHistoryVersion,
    }),
    [onboardResult, scanReport, explainPoints, jobProgress, scanHistoryVersion],
  )

  return <CodeAtlasCtx.Provider value={value}>{children}</CodeAtlasCtx.Provider>
}

export function useCodeAtlas() {
  const ctx = useContext(CodeAtlasCtx)
  if (!ctx) throw new Error("useCodeAtlas must be used within CodeAtlasProvider")
  return ctx
}
