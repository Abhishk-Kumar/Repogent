"use client"

import { useEffect, useState } from "react"
import { Copy, Trash2, Plus, Key, Check, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { motion } from "motion/react"
import { Button } from "@/components/ui/button"
import { createApiKey, listApiKeys, revokeApiKey } from "@/lib/codeatlas/api"
import { useCodeAtlas } from "@/lib/codeatlas/context"
import type { ApiKeyListItem, ApiKeyCreateResponse } from "@/lib/codeatlas/types"

function KeysList({ keys, loading, revoking, onRevoke }: {
  keys: ApiKeyListItem[]
  loading: boolean
  revoking: string | null
  onRevoke: (prefix: string) => void
}) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (keys.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card/50 p-8 text-center">
        <Key className="size-12 mx-auto text-muted-foreground/50 mb-2" />
        <p className="text-sm text-muted-foreground">No API keys yet</p>
        <p className="text-xs text-muted-foreground/70 mt-1">Create your first key above</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {keys.map(key => (
        <motion.div
          key={key.id}
          initial={{ opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.2 }}
          className="flex items-center justify-between rounded-lg border border-border bg-card/50 p-3"
        >
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm font-medium text-foreground">{key.prefix}…</span>
              {key.name && (
                <span className="text-xs text-muted-foreground px-2 py-0.5 rounded bg-secondary/50">
                  {key.name}
                </span>
              )}
              <span
                className={`text-xs px-2 py-0.5 rounded-full ${
                  key.is_active
                    ? "bg-emerald-500/10 text-emerald-500"
                    : "bg-red-500/10 text-red-500"
                }`}
              >
                {key.is_active ? "Active" : "Revoked"}
              </span>
            </div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground ml-2 shrink-0">
              <span>Created {new Date(key.created_at).toLocaleDateString()}</span>
              {key.last_used_at && (
                <>
                  <span>·</span>
                  <span>Last used {new Date(key.last_used_at).toLocaleDateString()}</span>
                </>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {key.is_active && (
              <>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => {
                    toast.error("Key not shown again — copy it at creation time")
                  }}
                  title="Key not shown again (copy at creation)"
                  disabled
                >
                  <Copy className="size-4 opacity-50" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => onRevoke(key.prefix)}
                  disabled={revoking === key.prefix}
                  className="text-red-500 hover:bg-red-500/10"
                >
                  {revoking === key.prefix ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Trash2 className="size-4" />
                  )}
                </Button>
              </>
            )}
          </div>
        </motion.div>
      ))}
    </div>
  )
}

export function SettingsTab() {
  const { onboardResult } = useCodeAtlas()
  const [keys, setKeys] = useState<ApiKeyListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [newKeyName, setNewKeyName] = useState("")
  const [showNewKey, setShowNewKey] = useState<ApiKeyCreateResponse | null>(null)
  const [revoking, setRevoking] = useState<string | null>(null)

  const repoIdentifier = onboardResult?.sessionId || ""

  const refreshKeys = async () => {
    if (!repoIdentifier) return
    setLoading(true)
    try {
      const data = await listApiKeys(repoIdentifier)
      setKeys(data)
    } catch {
      toast.error("Failed to load API keys")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refreshKeys()
  }, [repoIdentifier])

  const handleCreateKey = async () => {
    if (!repoIdentifier) return
    setCreating(true)
    try {
      const result = await createApiKey(repoIdentifier, newKeyName)
      setShowNewKey(result)
      setNewKeyName("")
      await refreshKeys()
      toast.success("API key created — copy it now, you won't see it again")
    } catch {
      toast.error("Failed to create API key")
    } finally {
      setCreating(false)
    }
  }

  const handleCopyKey = (key: string) => {
    navigator.clipboard.writeText(key)
    toast.success("Copied to clipboard")
  }

  const handleRevokeKey = async (prefix: string) => {
    setRevoking(prefix)
    try {
      await revokeApiKey(prefix)
      toast.success("API key revoked")
      await refreshKeys()
    } catch {
      toast.error("Failed to revoke API key")
    } finally {
      setRevoking(null)
    }
  }

  if (!repoIdentifier) {
    return (
      <div className="flex h-full items-center justify-center p-4 text-center">
        <div className="space-y-4">
          <Key className="size-12 mx-auto text-muted-foreground/50" />
          <div>
            <h3 className="text-lg font-semibold">No repository loaded</h3>
            <p className="text-sm text-muted-foreground">
              Onboard a repository to manage MCP API keys
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-border px-4">
        <div className="flex items-center gap-2">
          <Key className="size-5 text-primary" />
          <h2 className="text-base font-semibold">MCP Settings</h2>
        </div>
        <span className="text-xs text-muted-foreground">
          {keys.filter(k => k.is_active).length} active key{keys.filter(k => k.is_active).length !== 1 ? "s" : ""}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* API Keys Section */}
        <section>
          <h3 className="text-sm font-semibold text-foreground mb-3">API Keys</h3>
          <p className="text-xs text-muted-foreground mb-4 max-w-xs">
            Generate API keys to authenticate MCP server connections. Keys are hashed at rest
            and never stored in plaintext. Copy your key immediately — it won't be shown again.
          </p>

          {/* Create Key Form */}
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl border border-border bg-card/50 p-4 space-y-3"
          >
            <div className="flex gap-2">
              <input
                type="text"
                value={newKeyName}
                onChange={e => setNewKeyName(e.target.value)}
                placeholder="Key name (e.g., Cursor, CI/CD)"
                className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/40"
              />
              <Button
                onClick={handleCreateKey}
                disabled={creating}
                className="shrink-0"
              >
                {creating && <Loader2 className="size-4 animate-spin" />}
                {creating ? "Creating…" : "Create Key"}
                <Plus className="size-3.5" />
              </Button>
            </div>
          </motion.div>

          {/* Keys List */}
          <KeysList keys={keys} loading={loading} revoking={revoking} onRevoke={handleRevokeKey} />
        </section>

        {/* MCP Config Helper */}
        <section>
          <h3 className="text-sm font-semibold text-foreground mb-3">Quick Setup</h3>
          <div className="rounded-xl border border-border bg-card/50 p-4 space-y-3">
            <p className="text-xs text-muted-foreground">
              One-click configs for your MCP client (copies the exact JSON snippet):
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const snippet = JSON.stringify({
                    mcpServers: {
                      codeatlas: {
                        command: "npx",
                        args: ["-y", "codeatlas-mcp", "--repo", repoIdentifier.replace("https://github.com/", ""), "--key", "YOUR_API_KEY"],
                        env: {},
                      },
                    },
                  }, null, 2)
                  navigator.clipboard.writeText(snippet)
                  toast.success("Cursor config copied — paste into Cursor MCP settings")
                }}
              >
                <Copy className="size-3.5" />
                Add to Cursor
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const snippet = JSON.stringify({
                    mcpServers: {
                      codeatlas: {
                        command: "npx",
                        args: ["-y", "codeatlas-mcp", "--repo", repoIdentifier.replace("https://github.com/", ""), "--key", "YOUR_API_KEY"],
                        env: {},
                      },
                    },
                  }, null, 2)
                  navigator.clipboard.writeText(snippet)
                  toast.success("Claude Code config copied — paste into Claude Code MCP settings")
                }}
              >
                <Copy className="size-3.5" />
                Add to Claude Code
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Or add manually to any MCP client config:
            </p>
            <pre className="rounded-lg border border-border bg-muted p-3 overflow-x-auto text-[11px] font-mono text-muted-foreground">
{`{
  "mcpServers": {
    "codeatlas": {
      "command": "npx",
      "args": [
        "-y",
        "codeatlas-mcp",
        "--repo",
        "${repoIdentifier.replace("https://github.com/", "")}",
        "--key",
        "YOUR_API_KEY"
      ]
    }
  }`}
            </pre>
            <p className="text-xs text-muted-foreground">
              Replace <code className="font-mono">YOUR_API_KEY</code> with a key from above.
              For local stdio transport, the key can also be set via <code className="font-mono">CODEATLAS_API_KEY</code> env var.
            </p>
          </div>
        </section>
      </div>
    </div>
  )
}