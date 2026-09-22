import { NextRequest, NextResponse } from "next/server"

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000"

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const installationId = searchParams.get("installation_id")
  const code = searchParams.get("code")
  const setupAction = searchParams.get("setup_action")

  const sourceRepo = request.cookies.get("github_connect_repo")?.value || ""

  if (installationId) {
    try {
      await fetch(`${API_BASE}/github/connect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          repo_url: sourceRepo,
          installation_id: Number(installationId),
        }),
      })
    } catch {
      // silent — the repo_url might be missing
    }
  }

  const redirectUrl = sourceRepo
    ? `/workspace?repo=${encodeURIComponent(sourceRepo)}&github_connected=1`
    : "/workspace"

  return NextResponse.redirect(new URL(redirectUrl, request.url))
}
