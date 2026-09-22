import type {
  ChatMessage,
  ExplainPoint,
  RepoEdge,
  RepoFileNode,
  RepoGraph,
  ScanReport,
  TechBadge,
  JobStatus,
} from "./types"

const BASE = process.env.NEXT_PUBLIC_API_BASE_URL || (typeof window !== 'undefined' ? window.location.origin : "http://localhost:8000")

const FETCH_TIMEOUT = 30_000

async function post<T>(path: string, body: unknown, signal?: AbortSignal): Promise<T> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT)
  try {
    const res = await fetch(`${BASE}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: signal || controller.signal,
    })
    if (!res.ok) {
      const text = await res.text().catch(() => "")
      throw new Error(`POST ${path} ${res.status}: ${text}`)
    }
    return res.json()
  } finally {
    clearTimeout(timeoutId)
  }
}

async function get<T>(path: string, signal?: AbortSignal): Promise<T> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT)
  try {
    const res = await fetch(`${BASE}${path}`, { signal: signal || controller.signal })
    if (!res.ok) {
      const text = await res.text().catch(() => "")
      throw new Error(`GET ${path} ${res.status}: ${text}`)
    }
    return res.json()
  } finally {
    clearTimeout(timeoutId)
  }
}

function classifyByFolder(folder: string): RepoFileNode["group"] {
  const f = folder.toLowerCase()
  if (["app", "api", "routes", "controllers", "services", "middleware"].some((p) => f.startsWith(p) || f === p))
    return "backend"
  if (["web", "ui", "frontend", "components", "pages", "views"].some((p) => f.startsWith(p) || f === p))
    return "frontend"
  if (["config", "conf", "settings"].some((p) => f.startsWith(p) || f === p))
    return "config"
  if (["models", "db", "database", "migrations", "data", "migrations"].some((p) => f.startsWith(p) || f === p))
    return "data"
  return "util"
}

function computePosition(
  nodes: { id: string; deps: string[] }[],
  horizontal = true,
): Map<string, { x: number; y: number }> {
  const pos = new Map<string, { x: number; y: number }>()
  const levels = new Map<string, number>()

  function getLevel(id: string, chain = new Set<string>()): number {
    if (levels.has(id)) return levels.get(id)!
    if (chain.has(id)) return 0
    chain.add(id)
    const node = nodes.find((n) => n.id === id)
    if (!node || node.deps.length === 0) {
      levels.set(id, 0)
      return 0
    }
    const maxDep = Math.max(...node.deps.map((d) => getLevel(d, chain)))
    levels.set(id, maxDep + 1)
    return maxDep + 1
  }

  for (const n of nodes) {
    getLevel(n.id)
  }

  const byLevel = new Map<number, string[]>()
  for (const n of nodes) {
    const lvl = levels.get(n.id) ?? 0
    if (!byLevel.has(lvl)) byLevel.set(lvl, [])
    byLevel.get(lvl)!.push(n.id)
  }

  const sortedLevels = [...byLevel.entries()].sort((a, b) => a[0] - b[0])
  const maxInLevel = Math.max(...sortedLevels.map(([, ids]) => ids.length), 1)

  const nodeW = 200
  const nodeH = 80
  const padX = 60
  const padY = 60

  if (horizontal) {
    const totalH = maxInLevel * (nodeH + padY)
    for (const [lvl, ids] of sortedLevels) {
      const count = ids.length
      const startY = (totalH - count * (nodeH + padY)) / 2
      ids.forEach((id, i) => {
        pos.set(id, {
          x: lvl * (nodeW + padX),
          y: startY + i * (nodeH + padY),
        })
      })
    }
  } else {
    const totalW = maxInLevel * (nodeW + padX)
    for (const [lvl, ids] of sortedLevels) {
      const count = ids.length
      const startX = (totalW - count * (nodeW + padX)) / 2
      ids.forEach((id, i) => {
        pos.set(id, {
          x: startX + i * (nodeW + padX),
          y: lvl * (nodeH + padY),
        })
      })
    }
  }

  return pos
}

function makeUsedByMap(
  nodes: { id: string; deps: string[] }[],
): Map<string, string[]> {
  const usedBy = new Map<string, string[]>()
  for (const n of nodes) {
    for (const d of n.deps) {
      if (!usedBy.has(d)) usedBy.set(d, [])
      usedBy.get(d)!.push(n.id)
    }
  }
  return usedBy
}

function languageToKind(lang: string): TechBadge["kind"] {
  const langs = new Set(["python", "javascript", "typescript", "go", "java", "rust", "ruby"])
  const dbs = new Set(["postgresql", "mysql", "sqlite", "mongodb", "redis"])
  const fw = lang.toLowerCase()
  if (langs.has(fw)) return "language"
  if (dbs.has(fw)) return "database"
  return "framework"
}

const FRAMEWORK_KEYWORDS = [
  { id: "fastapi", keywords: ["fastapi"], label: "FastAPI" },
  { id: "flask", keywords: ["flask"], label: "Flask" },
  { id: "django", keywords: ["django"], label: "Django" },
  { id: "react", keywords: ["react", "jsx", "tsx"], label: "React" },
  { id: "nextjs", keywords: ["next"], label: "Next.js" },
  { id: "express", keywords: ["express"], label: "Express" },
  { id: "node", keywords: ["node", "node_modules", "package.json", "npm"], label: "Node.js" },
  { id: "tailwind", keywords: ["tailwind"], label: "Tailwind CSS" },
  { id: "typescript", keywords: ["typescript", "tsconfig"], label: "TypeScript" },
  { id: "jquery", keywords: ["jquery"], label: "jQuery" },
  { id: "vue", keywords: ["vue"], label: "Vue" },
  { id: "angular", keywords: ["angular"], label: "Angular" },
  { id: "prisma", keywords: ["prisma", "schema.prisma"], label: "Prisma" },
  { id: "postgresql", keywords: ["postgres", "psql", "pg"], label: "PostgreSQL" },
  { id: "mongodb", keywords: ["mongo", "mongodb"], label: "MongoDB" },
  { id: "redis", keywords: ["redis"], label: "Redis" },
  { id: "docker", keywords: ["docker", "dockerfile"], label: "Docker" },
]

function inferTechStack(nodes: { language: string; id: string; label?: string; folder?: string }[]): TechBadge[] {
  const weight = new Map<string, { tech: TechBadge; score: number }>()

  function add(id: string, label: string, kind: TechBadge["kind"], score = 1) {
    const existing = weight.get(id)
    if (existing) {
      existing.score += score
    } else {
      weight.set(id, { tech: { id, label, kind }, score })
    }
  }

  for (const n of nodes) {
    const key = n.language.toLowerCase()
    if (key && key !== "other") {
      add(key, n.language, languageToKind(key))
    }
    for (const fw of FRAMEWORK_KEYWORDS) {
      const matches = fw.keywords.some(
        (kw) =>
          n.id.toLowerCase().includes(kw) ||
          n.label?.toLowerCase().includes(kw) ||
          n.folder?.toLowerCase().includes(kw),
      )
      if (matches) {
        add(fw.id, fw.label, "framework", 10)
      }
    }
  }

  return [...weight.entries()]
    .sort((a, b) => b[1].score - a[1].score)
    .slice(0, 6)
    .map(([, v]) => v.tech)
}

function mapBackendGraphToFrontend(data: {
  nodes: {
    id: string
    label: string
    folder: string
    language: string
    functions: string[]
    classes: string[]
    purpose: string
  }[]
  edges: { id: string; source: string; target: string }[]
}): RepoGraph {
  const depsList: { id: string; deps: string[] }[] = data.nodes.map((n) => {
    const myDeps = data.edges
      .filter((e) => e.source === n.id)
      .map((e) => e.target)
    return { id: n.id, deps: myDeps }
  })

  const usedBy = makeUsedByMap(depsList)
  const positions = computePosition(depsList)
  const tech = inferTechStack(data.nodes)

  return {
    nodes: data.nodes.map((n) => ({
      id: n.id,
      label: n.label,
      path: n.id,
      group: classifyByFolder(n.folder),
      description: n.purpose || `${n.folder} module with ${n.functions.length} function${n.functions.length !== 1 ? "s" : ""}`,
      dependsOn: depsList.find((d) => d.id === n.id)?.deps ?? [],
      usedBy: usedBy.get(n.id) ?? [],
      position: positions.get(n.id) ?? { x: 0, y: 0 },
    })),
    edges: data.edges,
    tech,
  }
}

// ── New polling-based onboarding ──

export async function startPollingJob(
  repoUrl: string,
  onProgress: (message: string, current: number, total: number) => void,
  onComplete: (data: { sessionId: string; graph: RepoGraph; fileList: string[] }) => void,
  onError: (err: string) => void,
  signal?: AbortSignal,
): Promise<void> {
  try {
    const { job_id } = await post<{ job_id: string; status: string }>("/onboard/async", { repo_url: repoUrl })

    const pollInterval = 2000

    while (true) {
      if (signal?.aborted) return

      const status = await get<JobStatus>(`/jobs/${job_id}/status`)

      if (status.status === "failed") {
        onError(status.error_message || "Job failed")
        return
      }

      if (status.progress_message) {
        onProgress(status.progress_message, status.progress_current, status.progress_total)
      }

      if (status.status === "done" && status.result) {
        const result = status.result as {
          dependency_graph: {
            nodes: { id: string; label: string; folder: string; language: string; functions: string[]; classes: string[]; purpose: string }[]
            edges: { id: string; source: string; target: string }[]
          }
          sources: string[]
        }
        const graph = mapBackendGraphToFrontend(result.dependency_graph)
        onComplete({
          sessionId: repoUrl,
          graph,
          fileList: result.sources ?? [],
        })
        return
      }

      if (status.status === "running" || status.status === "pending") {
        await new Promise((resolve) => setTimeout(resolve, pollInterval))
      }
    }
  } catch (err) {
    if (signal?.aborted) return
    onError(err instanceof Error ? err.message : "Unknown error")
  }
}


export async function fetchRepoGraph(sessionId: string): Promise<RepoGraph> {
  const data = await post<{
    nodes: {
      id: string
      label: string
      folder: string
      language: string
      functions: string[]
      classes: string[]
      purpose: string
    }[]
    edges: { id: string; source: string; target: string }[]
    isolated_files: string[]
    routes: { file: string; method: string; path: string }[]
  }>("/graph", { session_id: sessionId })
  return mapBackendGraphToFrontend(data)
}

export async function fetchScanReport(
  sessionId: string,
): Promise<ScanReport> {
  const data = await post<ScanReport>("/scan_report", {
    session_id: sessionId,
  })
  return data
}

export async function saveScanHistory(repoUrl: string, report: ScanReport): Promise<void> {
  await post("/scan_history", { repo_url: repoUrl, report })
}

export async function fetchExplain(
  sessionId: string,
): Promise<ExplainPoint[]> {
  const data = await post<{ points: ExplainPoint[] }>("/explain_repo", {
    session_id: sessionId,
  })
  return data.points
}

export async function sendChatMessage(
  sessionId: string,
  _history: ChatMessage[],
  message: string,
): Promise<string> {
  const data = await post<{ answer: string }>("/ask", {
    session_id: sessionId,
    question: message,
  })
  return data.answer
}
