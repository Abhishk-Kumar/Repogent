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

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ErrorCode,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import axios, { AxiosInstance } from "axios";
import { z } from "zod";
import { createServer } from "http";
import { parseArgs } from "node:util";

// ─── Config ────────────────────────────────────────────────────────

interface Config {
  apiBaseUrl: string;
  apiKey: string;
  repoIdentifier: string;
  transport: "stdio" | "http";
  httpPort: number;
}

function loadConfig(): Config {
  const args = parseArgs({
    options: {
      stdio: { type: "boolean", default: false },
      http: { type: "boolean", default: false },
      port: { type: "string", default: "3001" },
      repo: { type: "string" },
      key: { type: "string" },
      "api-url": { type: "string" },
    },
  });

  const transport = args.values.stdio ? "stdio" : args.values.http ? "http" : "stdio";
  const apiBaseUrl = args.values["api-url"] || process.env.CODEATLAS_API_URL || "http://localhost:8000";
  const apiKey = args.values.key || process.env.CODEATLAS_API_KEY || "";
  const repoIdentifier = args.values.repo || process.env.CODEATLAS_REPO || "";
  const httpPort = parseInt(args.values.port || process.env.CODEATLAS_MCP_PORT || "3001", 10);

  if (!repoIdentifier) {
    console.error("ERROR: Repository identifier required (--repo or CODEATLAS_REPO)");
    process.exit(1);
  }

  if (transport === "http" && !apiKey) {
    console.error("ERROR: API key required for HTTP transport (--key or CODEATLAS_API_KEY)");
    process.exit(1);
  }

  return {
    apiBaseUrl,
    apiKey,
    repoIdentifier,
    transport,
    httpPort,
  };
}

// ─── API Client ────────────────────────────────────────────────────

function createApiClient(config: Config): AxiosInstance {
  const client = axios.create({
    baseURL: config.apiBaseUrl,
    timeout: 60000,
    headers: {
      "Content-Type": "application/json",
    },
  });

  // Add API key to requests (for HTTP transport)
  if (config.apiKey) {
    client.defaults.headers.common["Authorization"] = `Bearer ${config.apiKey}`;
  }

  return client;
}

// ─── Tool Schemas ──────────────────────────────────────────────────

const ListFilesSchema = z.object({
  repo: z.string().optional().describe("Repository identifier (defaults to configured repo)"),
});

const GetDependencyGraphSchema = z.object({
  repo: z.string().optional().describe("Repository identifier (defaults to configured repo)"),
  file: z.string().optional().describe("Optional file path to filter graph to relevant subgraph"),
});

const GetScanFindingsSchema = z.object({
  repo: z.string().optional().describe("Repository identifier (defaults to configured repo)"),
  severity: z.enum(["critical", "high", "medium", "low"]).optional().describe("Filter by severity"),
});

const AskCodebaseSchema = z.object({
  repo: z.string().optional().describe("Repository identifier (defaults to configured repo)"),
  question: z.string().describe("Natural language question about the codebase"),
});

const GetHealthScoreSchema = z.object({
  repo: z.string().optional().describe("Repository identifier (defaults to configured repo)"),
});

// ─── Tool Implementations ──────────────────────────────────────────

async function listFiles(client: AxiosInstance, repo: string): Promise<any> {
  try {
    const resp = await client.post("/graph", { session_id: repo });
    const graph = resp.data;
    const nodes = graph.nodes || [];

    // Build a file tree from node IDs
    const tree: Record<string, any> = {};
    for (const node of nodes) {
      const parts = node.id.split("/");
      let current = tree;
      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        if (!current[part]) {
          current[part] = i === parts.length - 1 ? { type: "file", ...node } : { type: "dir", children: {} };
        }
        if (i < parts.length - 1) {
          current = current[part].children;
        }
      }
    }

    return {
      repo,
      fileCount: nodes.length,
      tree,
    };
  } catch (e: any) {
    throw new McpError(ErrorCode.InternalError, `Failed to list files: ${e.message}`);
  }
}

async function getDependencyGraph(client: AxiosInstance, repo: string, file?: string): Promise<any> {
  try {
    const resp = await client.post("/graph", { session_id: repo });
    const graph = resp.data as {
      nodes: Array<{ id: string; [key: string]: any }>;
      edges: Array<{ source: string; target: string; [key: string]: any }>;
      isolated_files?: string[];
      routes?: any[];
      unresolved_imports?: number;
      unparsed_files?: string[];
    };

    let nodes = graph.nodes || [];
    let edges = graph.edges || [];

    if (file) {
      // Filter to subgraph relevant to the file
      const relevantNodes = new Set<string>();
      const queue = [file];
      const nodeMap = new Map(nodes.map((n: { id: string }) => [n.id, n]));

      while (queue.length) {
        const current = queue.shift()!;
        if (relevantNodes.has(current)) continue;
        relevantNodes.add(current);

        // Find edges where current is source or target
        for (const edge of edges) {
          if (edge.source === current && !relevantNodes.has(edge.target)) {
            queue.push(edge.target);
          }
          if (edge.target === current && !relevantNodes.has(edge.source)) {
            queue.push(edge.source);
          }
        }
      }

      nodes = nodes.filter((n: { id: string }) => relevantNodes.has(n.id));
      edges = edges.filter((e: { source: string; target: string }) =>
        relevantNodes.has(e.source) && relevantNodes.has(e.target)
      );
    }

    return {
      repo,
      file: file || null,
      nodes,
      edges,
      isolated_files: graph.isolated_files || [],
      routes: graph.routes || [],
      unresolved_imports: graph.unresolved_imports || 0,
      unparsed_files: graph.unparsed_files || [],
    };
  } catch (e: any) {
    throw new McpError(ErrorCode.InternalError, `Failed to get dependency graph: ${e.message}`);
  }
}

async function getScanFindings(client: AxiosInstance, repo: string, severity?: string): Promise<any> {
  try {
    const resp = await client.post("/scan_report", { session_id: repo });
    const report = resp.data;

    let issues = report.issues || [];

    if (severity) {
      issues = issues.filter((i: any) => i.severity === severity);
    }

    return {
      repo,
      health_score: report.score,
      grade: report.grade,
      summary: report.summary,
      metrics: report.metrics,
      total_findings: issues.length,
      findings: issues,
      improvements: report.improvements || [],
    };
  } catch (e: any) {
    throw new McpError(ErrorCode.InternalError, `Failed to get scan findings: ${e.message}`);
  }
}

async function askCodebase(client: AxiosInstance, repo: string, question: string): Promise<any> {
  try {
    const resp = await client.post("/ask", { session_id: repo, question });
    return {
      repo,
      question,
      answer: resp.data.answer || resp.data.error || "No answer available",
      error: resp.data.error || null,
    };
  } catch (e: any) {
    throw new McpError(ErrorCode.InternalError, `Failed to ask codebase: ${e.message}`);
  }
}

async function getHealthScore(client: AxiosInstance, repo: string): Promise<any> {
  try {
    const resp = await client.post("/scan_report", { session_id: repo });
    const report = resp.data;

    return {
      repo,
      score: report.score,
      grade: report.grade,
      summary: report.summary,
      metrics: report.metrics,
    };
  } catch (e: any) {
    throw new McpError(ErrorCode.InternalError, `Failed to get health score: ${e.message}`);
  }
}

// ─── MCP Server Setup ──────────────────────────────────────────────

function createMcpServer(config: Config, apiClient: AxiosInstance): Server {
  const server = new Server(
    {
      name: "codeatlas",
      version: "0.1.0",
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // List tools
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: "list_files",
        description: "List all files in the analyzed repository as a tree",
        inputSchema: {
          type: "object",
          properties: {
            repo: { type: "string", description: "Repository identifier (optional, uses configured repo)" },
          },
        } as const,
      },
      {
        name: "get_dependency_graph",
        description: "Get the dependency graph (nodes + edges) for the repository or a specific file's subgraph",
        inputSchema: {
          type: "object",
          properties: {
            repo: { type: "string", description: "Repository identifier (optional, uses configured repo)" },
            file: { type: "string", description: "Optional file path to filter to relevant subgraph" },
          },
        } as const,
      },
      {
        name: "get_scan_findings",
        description: "Get security scan findings with optional severity filter",
        inputSchema: {
          type: "object",
          properties: {
            repo: { type: "string", description: "Repository identifier (optional, uses configured repo)" },
            severity: { type: "string", enum: ["critical", "high", "medium", "low"], description: "Filter by severity" },
          },
        } as const,
      },
      {
        name: "ask_codebase",
        description: "Ask a natural language question about the codebase (RAG over analyzed repo)",
        inputSchema: {
          type: "object",
          properties: {
            repo: { type: "string", description: "Repository identifier (optional, uses configured repo)" },
            question: { type: "string", description: "Question to ask about the codebase" },
          },
          required: ["question"],
        } as const,
      },
      {
        name: "get_health_score",
        description: "Get the health score, grade, and metrics for the repository",
        inputSchema: {
          type: "object",
          properties: {
            repo: { type: "string", description: "Repository identifier (optional, uses configured repo)" },
          },
        } as const,
      },
    ],
  }));

  // Call tool
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const repo = (request.params.arguments as { repo?: string })?.repo || config.repoIdentifier;

    switch (request.params.name) {
      case "list_files": {
        const args = ListFilesSchema.parse(request.params.arguments) as z.infer<typeof ListFilesSchema>;
        const result = await listFiles(apiClient, args.repo || repo);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }
      case "get_dependency_graph": {
        const args = GetDependencyGraphSchema.parse(request.params.arguments) as z.infer<typeof GetDependencyGraphSchema>;
        const result = await getDependencyGraph(apiClient, args.repo || repo, args.file);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }
      case "get_scan_findings": {
        const args = GetScanFindingsSchema.parse(request.params.arguments) as z.infer<typeof GetScanFindingsSchema>;
        const result = await getScanFindings(apiClient, args.repo || repo, args.severity);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }
      case "ask_codebase": {
        const args = AskCodebaseSchema.parse(request.params.arguments) as z.infer<typeof AskCodebaseSchema>;
        const result = await askCodebase(apiClient, args.repo || repo, args.question);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }
      case "get_health_score": {
        const args = GetHealthScoreSchema.parse(request.params.arguments) as z.infer<typeof GetHealthScoreSchema>;
        const result = await getHealthScore(apiClient, args.repo || repo);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }
      default:
        throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${request.params.name}`);
    }
  });

  return server;
}

// ─── Main ──────────────────────────────────────────────────────────

async function main() {
  const config = loadConfig();
  const apiClient = createApiClient(config);
  const server = createMcpServer(config, apiClient);

  if (config.transport === "stdio") {
    // stdio transport for Cursor, Claude Code, etc.
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("CodeAtlas MCP server running on stdio");
  } else {
    // Streamable HTTP transport
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined, // Stateless for simplicity
    });

    const httpServer = createServer(async (req, res) => {
      // Handle CORS
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

      if (req.method === "OPTIONS") {
        res.writeHead(204);
        res.end();
        return;
      }

      // Verify API key for HTTP transport
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        res.writeHead(401, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Missing or invalid Authorization header" }));
        return;
      }

      const providedKey = authHeader.slice(7);
      if (providedKey !== config.apiKey) {
        res.writeHead(401, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Invalid API key" }));
        return;
      }

      await transport.handleRequest(req, res, server);
    });

    httpServer.listen(config.httpPort, () => {
      console.error(`CodeAtlas MCP server running on HTTP port ${config.httpPort}`);
      console.error(`API endpoint: http://localhost:${config.httpPort}/mcp`);
    });

    await server.connect(transport);
  }
}

main().catch((e) => {
  console.error("Fatal error:", e);
  process.exit(1);
});