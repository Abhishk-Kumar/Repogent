# CodeAtlas demo video — 2-minute script (ACTION ITEM FOR OWNER)

> I cannot record or upload video. Record this script as an unlisted YouTube
> video, then embed on `/` and link in README (see 10.2). Suggested setup:
> 1440px browser capture, mic on, no facecam needed. Use
> `fastapi/fastapi` (analyzed live with staged progress; cached on repeat visits).

## 0:00–0:20 — Paste repo URL, honest progress (03)
- [0:00] Homepage visible. Say: "CodeAtlas turns any GitHub repo into an
  interactive map. Let me onboard one."
- [0:05] Paste `github.com/fastapi/fastapi`, submit. Show the inline
  validation state briefly by typing a bad URL first ("not-a-url" →
  red inline error), then the real URL.
- [0:10] Progress dialog: point out per-stage checkmarks appear only as each
  stage completes, with elapsed time + ETA ("Analyzing…", not "Starting…").
- [0:20] Workspace lands. Say: "About a minute, with honest progress."

## 0:20–0:50 — Graph with REAL edges (05)
- [0:20] Graph canvas: "1,142 files, 2,380 real dependency edges — not a
  zero-edge placeholder."
- [0:30] Zoom into `fastapi/routing.py`, click a node: show Depends on / Used
  by lists + functions panel.
- [0:40] Point at the diagnostics banner if visible: "It tells you what it
  couldn't resolve instead of faking zeros."
- [0:50] Say: "Pan, zoom, drag all work. Delete key is disabled — you can't
  break the graph."

## 0:50–1:15 — Chat, scan, tickets, Jira push (03 + 04)
- [0:50] Chat tab. Ask: "How does authentication work in this repo?" Show the
  typing indicator → grounded answer with file citations.
- [1:00] Second question immediately: "Where are API routes defined?" Show it
  answers (no swallowed follow-ups).
- [1:05] Scan tab: health score **with A–F grade**, metrics. Click
  "Select all major issues" → "Create N tickets" → success toast.
- [1:12] Tickets tab → "Push to Jira" on one ticket → show returned issue key
  + "Open in Jira ↗" link. Say: "Real issue in my test Jira site."

## 1:15–1:40 — Share to Slack, open /demo (06 + 07)
- [1:15] Scan header → "Share to Slack" → pick channel → post. Cut to Slack:
  show the Block Kit message (score, grade, top 3 findings, Open button).
- [1:25] Toggle "Notify me when scans complete" on.
- [1:30] Open `/demo` in a fresh incognito window: "Zero signup — watch the
  staged analysis run, then explore the interactive workspace."

## 1:40–2:00 — Agent via CodeAtlas MCP (09)
- [1:40] In Cursor/Claude Code with the CodeAtlas MCP config pasted (show the
  JSON snippet on `/docs/connect-agent`), ask the agent: "Where is auth
  handled in this repo?"
- [1:50] Show the agent calling `get_dependency_graph` + `ask_codebase` and
  answering with file paths.
- [1:58] Close: "CodeAtlas stops being a dashboard and becomes developer
  infrastructure. Link + live demo below."
