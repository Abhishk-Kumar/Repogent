import type { ApiKeyCreateResponse, ApiKeyListItem, ChatMessage, ExplainPoint, JiraStatus, RepoGraph, ScanReport, SlackStatus, Ticket } from "./types"
import * as client from "./client"

let _sessionId: string | null = null

export function setSessionId(id: string) {
  _sessionId = id
}

export function getSessionId(): string | null {
  return _sessionId
}

export async function fetchRepoGraph(): Promise<RepoGraph> {
  const sid = _sessionId
  if (!sid) throw new Error("No session ID set")
  return client.fetchRepoGraph(sid)
}

export async function fetchScanReport(): Promise<ScanReport> {
  const sid = _sessionId
  if (!sid) throw new Error("No session ID set")
  return client.fetchScanReport(sid)
}

export async function saveScanHistory(report: ScanReport): Promise<void> {
  const sid = _sessionId
  if (!sid) throw new Error("No session ID set")
  await client.saveScanHistory(sid, report)
}

export async function fetchExplain(): Promise<ExplainPoint[]> {
  const sid = _sessionId
  if (!sid) throw new Error("No session ID set")
  return client.fetchExplain(sid)
}

export async function sendChatMessage(history: ChatMessage[], message: string, signal?: AbortSignal): Promise<string> {
  const sid = _sessionId
  if (!sid) throw new Error("No session ID set")
  return client.sendChatMessage(sid, history, message, signal)
}

export async function listTickets(): Promise<Ticket[]> {
  const sid = _sessionId
  if (!sid) throw new Error("No session ID set")
  return client.listTickets(sid)
}

export async function createTicket(input: {
  title: string
  description: string
  severity: string
  source_finding_id: string
}): Promise<Ticket> {
  const sid = _sessionId
  if (!sid) throw new Error("No session ID set")
  return client.createTicket({ repo: sid, ...input })
}

export async function createTicketsBulk(input: {
  issues: { title: string; description: string; severity: string; source_finding_id: string }[]
}): Promise<{ created: Ticket[]; skipped: { source_finding_id: string; reason: string }[]; count: number }> {
  const sid = _sessionId
  if (!sid) throw new Error("No session ID set")
  return client.createTicketsBulk({ repo: sid, ...input })
}

export async function deleteTicket(id: number): Promise<void> {
  return client.deleteTicket(id)
}

export async function pushTicketToJira(id: number) {
  return client.pushTicketToJira(id)
}

export async function fetchJiraStatus(): Promise<JiraStatus> {
  return client.fetchJiraStatus()
}

export async function fetchJiraConnect() {
  return client.fetchJiraConnect()
}

export async function disconnectJira(): Promise<void> {
  return client.disconnectJira()
}

// File 06: Slack sharing + notifications.
export async function fetchSlackStatus(): Promise<SlackStatus> {
  return client.fetchSlackStatus()
}

export async function fetchSlackConnect() {
  return client.fetchSlackConnect()
}

export async function disconnectSlack(): Promise<void> {
  return client.disconnectSlack()
}

export async function fetchSlackChannels() {
  return client.fetchSlackChannels()
}

export async function shareScanToSlack(input: {
  repo: string
  channel: string
  health_score: number
  grade: string
  findings: { severity: string; title: string }[]
  report_url?: string
}) {
  return client.shareScanToSlack(input)
}

export async function saveSlackWebhook(webhook_url: string) {
  return client.saveSlackWebhook(webhook_url)
}

export async function shareScanViaWebhook(input: {
  repo: string
  health_score: number
  grade: string
  findings: { severity: string; title: string }[]
  report_url?: string
  webhook_url?: string
}) {
  return client.shareScanViaWebhook(input)
}

export async function setSlackNotify(enabled: boolean) {
  return client.setSlackNotify(enabled)
}

// File 09: MCP API key management.
export async function createApiKey(repoIdentifier: string, name: string): Promise<ApiKeyCreateResponse> {
  return client.createApiKey(repoIdentifier, name)
}

export async function listApiKeys(repoIdentifier: string): Promise<ApiKeyListItem[]> {
  return client.listApiKeys(repoIdentifier)
}

export async function revokeApiKey(prefix: string) {
  return client.revokeApiKey(prefix)
}
