
# Repogent (CodeAtlas)

AI-powered codebase onboarding. Paste a GitHub repo URL and get an interactive dependency graph, an AI assistant that answers questions about the code, and an automated security scan.

**Live demo:** https://YOUR-APP.vercel.app  *(frontend on Vercel)*
**API:** https://repogent.onrender.com  *(backend on Render, free tier)*

> **Heads up:** the backend runs on Render's free tier and sleeps after 15 minutes of inactivity. The first request after a nap can take 30-60 seconds while it wakes up. The app shows a "waking up" message during this time, so please give it a moment.

## What it does

- **Dependency graph:** two-level interactive graph (module overview, then file drill-down) built with Python AST and JS/TS parsing
- **AI chat (RAG):** ask questions about the repo, answered from retrieved code chunks
- **Security / health scan:** heuristic scan with a grade from A to F, exportable as JSON, CSV, TXT or PDF
- **Explain, trace and blast radius:** repo summary, LLM-narrated execution flow, and transitive impact analysis for any file

## Architecture

```
  Browser
     │
     ▼
┌──────────────────────┐        HTTPS (fetch + polling)       ┌────────────────────────────┐
│ Frontend (Vercel)    │ ───────────────────────────────────▶ │ Backend (Render, free)     │
│ Next.js 16 + React 19│                                      │ FastAPI + LangChain        │
│ React Flow, Tailwind │ ◀─────────────────────────────────── │                            │
└──────────────────────┘            JSON responses            │  Onboarding job:           │
                                                              │  clone → chunk → graph →   │
                                                              │  label → done              │
                                                              │                            │
                                                              │  LLM: Groq, Mistral        │
                                                              │       fallback + retry     │
                                                              │  Vectors: ChromaDB         │
                                                              │  Embeddings: HuggingFace   │
                                                              │       (hash fallback)      │
                                                              │  Jobs/history: SQLite      │
                                                              └────────────────────────────┘
```

The frontend and backend deploy separately. The frontend finds the API through `NEXT_PUBLIC_API_BASE_URL`, and the backend allows the frontend's origin through CORS.

## Quick start (local)

### Prerequisites

- Python 3.12+ and [uv](https://docs.astral.sh/uv/)
- Node.js 20+
- A [Groq API key](https://console.groq.com/) (free tier works)
- Optional: a [Mistral API key](https://console.mistral.ai/) for fallback

### Backend

```bash
cd backend
cp .env.example .env          # add GROQ_API_KEY
uv sync
uv run uvicorn app.main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
cp .env.example .env.local    # NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
npm run dev
```

Open http://localhost:3000, paste a public repo such as `github.com/psf/requests`, and click **Onboard Repository**.

## Deployment

### Backend on Render (free)

1. Create a **Web Service** from this repo (or use the `render.yaml` blueprint).
2. Root: repo root, build: `cd backend && pip install uv && uv sync --frozen`, start: `cd backend && uv run uvicorn app.main:app --host 0.0.0.0 --port $PORT`.
3. Health check path: `/health`.
4. Set environment variables: `GROQ_API_KEY`, `MISTRAL_API_KEY` (optional), and `CORS_ORIGINS` (your Vercel URL, comma-separated if more than one).

### Frontend on Vercel

1. Import the repo and set **Root Directory** to `frontend`. Framework: Next.js.
2. Add the environment variable `NEXT_PUBLIC_API_BASE_URL=https://repogent.onrender.com` (no trailing slash).
3. Deploy. Redeploy after changing the variable, because it is baked in at build time.

### Free-tier notes

- **Cold starts:** Render free services sleep after 15 minutes idle. The frontend pings `/health` on load and shows a "backend is waking up" state while it starts.
- **No persistent disk:** ChromaDB, SQLite history and cloned repos are wiped on every restart or redeploy. After a restart, re-onboard the repo.
- **Memory:** 512 MB, so very large repos may run out of memory.
- **Optional keep-alive:** a free uptime monitor (for example UptimeRobot) pinging `/health` every 5-10 minutes keeps the service awake.

## Environment variables

### Backend

| Variable                                                                   | Required      | Description                                                                 |
| -------------------------------------------------------------------------- | ------------- | --------------------------------------------------------------------------- |
| `GROQ_API_KEY`                                                           | Yes           | Primary LLM provider (fast, free tier)                                      |
| `MISTRAL_API_KEY`                                                        | No            | Fallback LLM provider                                                       |
| `CORS_ORIGINS`                                                           | In production | Allowed frontend origins, comma-separated (defaults to `*` for local dev) |
| `FRONTEND_URL`                                                           | No            | Frontend base URL, used for GitHub App redirects                            |
| `VECTOR_STORE_PATH`                                                      | No            | ChromaDB path (default `data/chroma_db`)                                  |
| `CLONE_TEMP_DIR`                                                         | No            | Cloned-repo temp dir (default `data/repos`)                               |
| `DB_PATH`                                                                | No            | SQLite path (default `data/codeatlas.db`)                                 |
| `GITHUB_TOKEN`                                                           | No            | Higher GitHub API rate limits for repo fetching                             |
| `TAVILY_API_KEY` / `FIRECRAWL_API_KEY`                                 | No            | Web search and scrape tools for the agent                                   |
| `GITHUB_APP_ID` / `GITHUB_APP_PRIVATE_KEY` / `GITHUB_WEBHOOK_SECRET` | No            | GitHub App integration and webhooks only                                    |
| `GOOGLE_SHEET_ID` / `GOOGLE_SERVICE_ACCOUNT_PATH`                      | No            | Sheets logging integration only                                             |

### Frontend

| Variable                     | Required | Description                                  |
| ---------------------------- | -------- | -------------------------------------------- |
| `NEXT_PUBLIC_API_BASE_URL` | Yes      | Public URL of the backend, no trailing slash |

## Project structure

```
backend/
├── app/
│   ├── main.py              # FastAPI app, CORS, routes, optional static mount
│   ├── config.py            # pydantic-settings (.env)
│   ├── llm_router.py        # Groq → Mistral fallback with retry
│   ├── embeddings.py        # HuggingFace embeddings with hash fallback
│   ├── db.py / cache.py     # SQLite (SQLModel) + in-memory session store
│   ├── models/              # Pydantic schemas and SQLModel tables
│   ├── routes/              # onboard, jobs, integration, history, autofix, github_webhook
│   ├── graph/               # graph builder, Python AST parser, JS/TS parser, blast radius
│   ├── ingestion/           # repo loader, code-aware chunker, ChromaDB vector store
│   ├── chains/              # LLM chains (label, merge, flow-trace, start-here)
│   ├── agents/              # autofix pipeline (triage, fix, verify, PR)
│   ├── integrations/        # GitHub App auth, Sheets logging
│   └── tools/               # LangChain tools (file, search, scrape)
├── pyproject.toml + uv.lock # dependencies (uv)
└── requirements.txt         # pinned export, fallback only

frontend/
├── app/                     # Next.js routes: home, workspace, GitHub callback
├── components/              # hero, processing screen, graph canvas, chat/scan/explain panels
└── lib/codeatlas/           # types, API wrappers, context, HTTP client
```

## Key design decisions

| Decision                        | Rationale                                                                                                                                 |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Polling for onboarding          | `/onboard/async` returns a job id and the frontend polls `/jobs/{id}/status` for progress through clone, chunk, graph and label steps |
| Groq with Mistral fallback      | Groq is fast with a generous free tier; Mistral catches auth and rate-limit failures transparently                                        |
| Embedding fallback              | HuggingFace embeddings by default, with a deterministic hash-based fallback so the app still works without the API                        |
| Two-level graph                 | Module overview, then file drill-down, so hundreds of nodes never land on the screen at once                                              |
| SQLite plus in-memory cache     | Jobs, scan history and PRs live in SQLite; hot sessions are cached in memory                                                              |
| AST for Python, regex for JS/TS | Reliable for Python; simpler but less robust for unusual JS/TS patterns                                                                   |
| Heuristic health scan           | File-ratio and regex checks, not a real SAST tool, so it stays fast per file                                                              |
| Split deployment                | Static-friendly Next.js on Vercel, API on Render, each on a free plan                                                                     |

## API endpoints

| Method   | Path                                        | Description                                         |
| -------- | ------------------------------------------- | --------------------------------------------------- |
| GET      | `/health`                                 | Health check, also used for wake-up pings           |
| GET      | `/health/llm`                             | Health check plus active LLM provider               |
| POST     | `/onboard/async`                          | Start background onboarding job, returns `job_id` |
| POST     | `/jobs/submit`                            | Submit a repo job (alternate entrypoint)            |
| GET      | `/jobs/{job_id}/status`                   | Poll job progress and result                        |
| POST     | `/graph`                                  | Get stored dependency graph                         |
| POST     | `/scan_report`                            | Code health scan (grade, metrics, issues)           |
| POST     | `/explain_repo`                           | Five summary bullet points about the repo           |
| POST     | `/ask`                                    | RAG-based Q&A with vector search                    |
| POST     | `/trace_flow`                             | LLM-narrated forward execution trace                |
| POST     | `/start_here`                             | Goal-guided reading path through the graph          |
| POST     | `/blast_radius`                           | Transitive dependency impact (BFS, depth up to 10)  |
| POST     | `/explain_file`                           | One-paragraph LLM file explanation                  |
| GET/POST | `/scan_history`                           | Fetch or save scan reports per repo                 |
| POST     | `/autofix/estimate`                       | Estimate an autofix run                             |
| POST     | `/autofix/run`                            | Run the autofix pipeline                            |
| GET      | `/autofix/prs/{repo}`                     | List autofix PRs for a repo                         |
| POST     | `/github/connect`, `/github/disconnect` | Link or unlink the GitHub App                       |
| GET      | `/github/connection/{repo}`               | Connection status for a repo                        |
| POST     | `/github/webhook`                         | GitHub App webhook receiver                         |

## Tech stack

**Backend:** FastAPI, LangChain, Groq, Mistral, ChromaDB, GitPython, SQLModel
**Frontend:** Next.js 16, React 19, React Flow (@xyflow/react), Tailwind CSS v4, Framer Motion
**Hosting:** Vercel (frontend), Render free tier (backend)
