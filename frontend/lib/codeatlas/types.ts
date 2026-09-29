export type NodeGroup = "backend" | "frontend" | "config" | "data" | "util"

export interface RepoFileNode {
  id: string
  label: string
  path: string
  group: NodeGroup
  description: string
  dependsOn: string[]
  usedBy: string[]
  position: { x: number; y: number }
}

export interface RepoEdge {
  id: string
  source: string
  target: string
}

export interface TechBadge {
  id: string
  label: string
  kind: "language" | "framework" | "database"
}

export interface RepoGraph {
  nodes: RepoFileNode[]
  edges: RepoEdge[]
  tech: TechBadge[]
  // 05.2: resolve-failure signals — distinguish genuine zero-import
  // repos from parse/resolve failures (never fake zeros).
  unresolvedImports?: number
  unparsedFiles?: string[]
}

export type AgentActivityState = "active" | "complete" | "warning"

export interface AgentActivity {
  id: string
  text: string
  state: AgentActivityState
}

export interface JobStatus {
  job_id: string
  status: "pending" | "running" | "done" | "failed"
  progress_current: number
  progress_total: number
  progress_message: string
  error_message: string | null
  result: Record<string, unknown> | null
}

export type Severity = "critical" | "high" | "medium" | "low"

export interface ScanIssue {
  id: string
  title: string
  severity: Severity
  file: string
  line: number
  detail: string
  fix: string
}

export interface HealthMetric {
  label: string
  value: number
  hint: string
}

export interface FutureImprovement {
  id: string
  title: string
  detail: string
}

export interface ScanReport {
  grade: "A" | "B" | "C" | "D" | "F"
  score: number
  summary: string
  metrics: HealthMetric[]
  issues: ScanIssue[]
  improvements: FutureImprovement[]
}

export interface ExplainPoint {
  id: string
  title: string
  body: string
  icon: "compass" | "layers" | "target" | "boxes" | "sparkles" | "terminal"
}

export interface ChatMessage {
  id: string
  role: "user" | "assistant"
  content: string
}

export type TicketStatus = "open" | "pushed"

export interface Ticket {
  id: number
  repo: string
  title: string
  description: string
  severity: Severity
  source_finding_id: string
  status: TicketStatus
  jira_issue_key?: string | null
  jira_url?: string | null
  created_at: string
}

export interface JiraStatus {
  connected: boolean
  site_name?: string
  site_url?: string
}

// File 06: Slack sharing + notifications (scoped: no bot commands).
export interface SlackStatus {
  connected: boolean
  team_name?: string
  notify_on_complete?: boolean
  has_webhook?: boolean
}

export interface SlackChannel {
  id: string
  name: string
  is_private: boolean
  is_member: boolean
}

export interface SlackShareFinding {
  severity: string
  title: string
}

export interface AgentActivityEvent {
  type: "progress" | "complete" | "error"
  message: string
}

// File 09: MCP API keys
export interface ApiKeyListItem {
  id: number
  prefix: string
  name: string
  repo_identifier: string
  is_active: boolean
  created_at: string
  last_used_at: string | null
  revoked_at: string | null
}

export interface ApiKeyCreateResponse {
  key: string
  prefix: string
  name: string
  created_at: string
}
