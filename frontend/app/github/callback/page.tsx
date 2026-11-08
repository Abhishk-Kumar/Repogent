"use client"

import { Suspense, useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { apiFetch } from "@/lib/codeatlas/config"

function getCookie(name: string): string {
  if (typeof document === "undefined") return ""
  const match = document.cookie
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${name}=`))
  return match ? decodeURIComponent(match.slice(name.length + 1)) : ""
}

function GitHubCallbackInner() {
  const searchParams = useSearchParams()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const installationId = searchParams.get("installation_id")
    // `code` / `setup_action` are informational only — no token exchange
    // happens here (no client secret in the frontend).
    const sourceRepo = getCookie("github_connect_repo")

    const finish = async () => {
      if (installationId && sourceRepo) {
        try {
          await apiFetch("/github/connect", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              repo_url: sourceRepo,
              installation_id: installationId,
            }),
          })
        } catch {
          // Non-fatal: still redirect so the user lands back in context.
          // The workspace can re-check GET /github/connection/{repo}.
          setError("Could not reach the API — continuing anyway.")
        }
      }
      // Clear the short-lived cookie set by GitHubConnect.
      document.cookie =
        "github_connect_repo=; path=/; max-age=0; SameSite=Lax"
      const target = sourceRepo
        ? `/workspace?repo=${encodeURIComponent(sourceRepo)}&github_connected=1`
        : "/workspace"
      // Small delay so a connection error (if any) is visible.
      window.setTimeout(() => {
        window.location.replace(target)
      }, error ? 1200 : 0)
    }

    finish()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  return (
    <div className="flex h-dvh flex-col items-center justify-center gap-3 bg-background p-4 text-center">
      <p className="text-sm font-medium">Finishing GitHub connection…</p>
      {error ? (
        <p className="max-w-sm text-sm text-muted-foreground">{error}</p>
      ) : (
        <p className="max-w-sm text-sm text-muted-foreground">
          You&apos;ll be redirected to your workspace shortly.
        </p>
      )}
    </div>
  )
}

export default function GitHubCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-dvh items-center justify-center bg-background text-sm text-muted-foreground">
          Finishing GitHub connection…
        </div>
      }
    >
      <GitHubCallbackInner />
    </Suspense>
  )
}
