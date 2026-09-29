#!/usr/bin/env node
/**
 * CodeAtlas MCP Server
 *
 * Exposes analyzed repository data via Model Context Protocol (MCP).
 * Supports both stdio (for local agents like Cursor, Claude Code)
 * and Streamable HTTP (for remote/hosted use).
 *
 * Tools:
 * - list_files(repo) — tree of analyzed repo
 * - get_dependency_graph(repo, file?) — nodes + real edges
 * - get_scan_findings(repo, severity?) — findings with severities
 * - ask_codebase(repo, question) — RAG answer over the repo
 * - get_health_score(repo) — score + grade breakdown
 *
 * Auth: API key via Authorization: Bearer <key> header (HTTP) or env var (stdio)
 */
export {};
//# sourceMappingURL=index.d.ts.map