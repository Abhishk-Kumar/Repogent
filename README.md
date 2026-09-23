# CodeAtlas

AI-powered codebase onboarding. Paste a GitHub repo URL and get an interactive dependency graph, an AI assistant that understands the code, and an automated security scan — all in minutes.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                   Frontend (Next.js 16)                     │
│  http://localhost:3000                                       │
│                                                             │
│  ┌──────────┐  ┌──────────────────────────────────────────┐ │
│  │ Home     │  │ Workspace                                 │ │
│  │ Page     │  │ ┌──────────┐  ┌──────────────────────┐   │ │
│  │ ┌──────┐ │  │ │ TopBar   │  │ GraphCanvas (65%)    │   │ │
│  │ │ Hero │─┼──┼→│ ┌──────┐ │  │ ┌──────────────────┐ │   │ │
│  │ │ URL  │ │  │ │ │Agent │ │  │ │ Module Overview   │ │   │ │
│  │ │input │ │  │ │ │bar   │ │  │ │ (circular cards)  │ │   │ │
│  │ └──────┘ │  │ │ └──────┘ │  │ │   ↓ click module  │ │   │ │
│  │ ┌──────┐ │  │ └──────────┘  │ │ │ Container + Grid │ │   │ │
│  │ │SSE   │─┼──┼→──────────────┼→│ │   ↓ click file   │ │   │ │
│  │ │modal │ │  │               │  │ │ NodePopover      │ │   │ │
│  │ └──────┘ │  │               │  │ └──────────────────┘ │   │ │
│  └──────────┘  │               │  └──────────────────────┘   │ │
│                 │               │  ┌──────────────────────┐   │ │
│                 │               │  │ RightPanel (35%)     │   │ │
│                 │               │  │ ┌─────┬──────┬─────┐ │   │ │
│                 │               │  │ │Chat │ Scan │Explain│   │ │
│                 │               │  │ └─────┴──────┴─────┘ │   │ │
│                 │               │  └──────────────────────┘   │ │
│                 │               └──────────────────────────────┘ │
│                 └─────────────────────────────────────────────────┘
│                         ▲ fetch / SSE                            │
│                         │                                        │
└─────────────────────────┼────────────────────────────────────────┘
                          │
┌─────────────────────────┼────────────────────────────────────────┐
│              Backend (FastAPI + LangChain)                       │
│              http://localhost:8000                                │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  POST /onboard/async → GET /jobs/{id}/status (polling)   │   │
│  │  ┌──────┐ → ┌──────┐ → ┌──────┐ → ┌──────┐ → ┌──────┐  │   │
│  │  │Clone │   │Chunk │   │Build │   │Label │   │Done  │  │   │
│  │  │ repo │   │files │   │graph │   │files │   │      │  │   │
│  │  └──────┘   └──────┘   └──────┘   └──────┘   └──────┘  │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  POST /graph       → returns dependency graph                   │
│  POST /scan_report → returns code health scan (grade A-F)       │
│  POST /explain_repo → returns 5 summary points                  │
│  POST /ask         → RAG-based Q&A (vector search + LLM)        │
│  POST /trace_flow  → LLM-narrated execution walkthrough         │
│  POST /blast_radius → transitive dependency impact analysis     │
│                                                                  │
│  ┌─────────────────────┐   ┌──────────────────────────────┐     │
│  │ Graph Builder        │   │ LLM (Groq → Mistral fallback)│     │
│  │ ├── Python AST       │   │ ┌──────────────────────────┐ │     │
│  │ ├── JS/TS regex      │   │ │ call_llm_with_retry()   │ │     │
│  │ ├── Flask/FastAPI    │   │ │ max 3 attempts, backoff │ │     │
│  │ └── Express routes   │   │ └──────────────────────────┘ │     │
│  └─────────────────────┘   └──────────────────────────────┘     │
│                                                                  │
│  ┌─────────────────────┐   ┌──────────────────────────────┐     │
│  │ Embeddings           │   │ Vector Store (ChromaDB)      │     │
│  │ ├── HuggingFace API  │   │ ├── Code-aware chunking     │     │
│  │ └── Hash fallback    │   │ └── Semantic search (top-5) │     │
│  └─────────────────────┘   └──────────────────────────────┘     │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ Job + session store (SQLite via SQLModel + in-memory cache) │   │
│  │ Key: repo_url → { repo_path, graph, file_list }          │   │
│  └──────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────┘
```

## Quick Start

### Prerequisites
- Python 3.12+
- Node.js 20+
- A [Groq API key](https://console.groq.com/) (free tier works)
- Optional: [Mistral API key](https://console.mistral.ai/) for fallback

### Backend

```bash
cd backend
cp .env.example .env    # add GROQ_API_KEY
uv venv && source .venv/bin/activate
uv sync
uvicorn app.main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
echo "NEXT_PUBLIC_API_BASE_URL=http://localhost:8000" > .env.local
npm run dev
```

Open `http://localhost:3000`, paste a public GitHub URL like `github.com/psf/requests`, and click **Onboard Repository**.

### Production (single process)

```bash
cd backend
uv venv && source .venv/bin/activate && uv sync
cd ../frontend && npm install && npm run build:static
cd ../backend
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

`npm run build:static` builds the Next.js static export and copies it into `backend/static/`. The backend serves the built frontend from `static/`, so `http://localhost:8000` serves everything.

### Deploy to Render

This project includes a `render.yaml` for infrastructure-as-code deployment to Render as a **single web service** (FastAPI serves the API + the built frontend on one domain).

> **Cost note:** the service uses a persistent disk for ChromaDB/SQLite/cloned repos, and disks require a paid instance. `render.yaml` uses `0.5c-512mb` (Starter, ~$7/mo). The free plan cannot attach a disk, so it is not supported for this app.

#### Option 1: Using render.yaml (Recommended)

1. **Commit and push** - `render.yaml` must be on your repo's default branch (`git add render.yaml`, commit, push to GitHub)
2. **New Blueprint** - Go to [Render Dashboard](https://dashboard.render.com) → **New → Blueprint**, select your repo. Render detects `render.yaml` and shows the `codeatlas` service.
3. **Enter secrets** - Blueprint prompts for (because they are `sync: false`):
   - `GROQ_API_KEY` (required — get one free at https://console.groq.com/)
   - `MISTRAL_API_KEY` (optional fallback — https://console.mistral.ai/)
4. **Apply** - Render provisions the service + 1 GB disk, builds (frontend static export → `backend/static/`, then `uv sync --frozen`), and starts `uvicorn` on `$PORT`.
5. **Verify** - Open `https://<your-service>.onrender.com/health` (should return `{"status":"ok"}`), then open the root URL and onboard a repo.

#### Option 2: Manual Web Service Setup

1. Create a new **Web Service** on Render, connect your GitHub repo (leave **Root Directory** blank = repo root).
2. Configure:
   - **Runtime**: Python
   - **Build Command** (Render's Python image has no Node and no `uv`, so the build installs both):
     ```bash
     curl -fsSL https://nodejs.org/dist/v20.18.0/node-v20.18.0-linux-x64.tar.xz -o /tmp/node.tar.xz
     mkdir -p /tmp/nodejs && tar -xJf /tmp/node.tar.xz -C /tmp/nodejs --strip-components=1
     export PATH=/tmp/nodejs/bin:$PATH
     cd frontend && npm ci && npm run build:static
     cd ../backend && pip install uv && uv sync --frozen
     ```
   - **Start Command**:
     ```bash
     cd backend && uv run uvicorn app.main:app --host 0.0.0.0 --port $PORT
     ```
   - **Health Check Path**: `/health`
   - **Environment Variables**:
     - `PYTHON_VERSION` = `3.14.3` (must be fully qualified)
     - `GROQ_API_KEY` = your Groq API key
     - `MISTRAL_API_KEY` = your Mistral API key (optional)
     - `VECTOR_STORE_PATH` = `/opt/render/project/src/backend/data/chroma_db`
     - `CLONE_TEMP_DIR` = `/opt/render/project/src/backend/data/repos`
     - `DB_PATH` = `/opt/render/project/src/backend/data/codeatlas.db`
3. Add a **Persistent Disk** (requires a paid plan — Starter or higher):
   - Name: `codeatlas-data`
   - Mount Path: `/opt/render/project/src/backend/data`
   - Size: 1 GB (increase for many/large repos)
4. Deploy. First build takes several minutes (Next.js build + Python deps).

#### How it works on Render

- The frontend is built as a static export (`output: "export"` in `next.config.mjs`)
- `npm run build:static` copies the export to `backend/static/`, served by FastAPI's `StaticFiles`
- Single service serves both API and frontend at the same domain — no CORS / URL config needed
- The frontend detects the API base URL via `window.location.origin` at runtime, so `NEXT_PUBLIC_API_BASE_URL` is intentionally **unset** in production (do not set it to the private `hostport` — that's the internal network address, not the public URL)
- ChromaDB, SQLite (`codeatlas.db`) and cloned repos persist on the mounted disk; without the disk, sessions vanish on every restart/redeploy

#### Environment Variables

| Variable | Required | Description |
|---|---|---|
| `GROQ_API_KEY` | Yes | Primary LLM provider (fast, free tier) |
| `MISTRAL_API_KEY` | No | Fallback LLM provider |
| `VECTOR_STORE_PATH` | No | ChromaDB path (defaults to `data/chroma_db`; set to disk path on Render) |
| `CLONE_TEMP_DIR` | No | Cloned-repo temp dir (defaults to `data/repos`) |
| `DB_PATH` | No | SQLite path (defaults to `data/codeatlas.db`) |
| `GITHUB_TOKEN` | No | Higher GitHub API rate limits for repo fetching |
| `TAVILY_API_KEY` / `FIRECRAWL_API_KEY` | No | Web-search/scrape tools for the agent |
| `GITHUB_APP_ID` / `GITHUB_APP_PRIVATE_KEY` / `GITHUB_WEBHOOK_SECRET` | No | GitHub App integration + webhooks only |
| `GOOGLE_SHEET_ID` / `GOOGLE_SERVICE_ACCOUNT_PATH` | No | Sheets logging integration only |

## Project Structure

```
backend/
├── app/
│   ├── main.py                  # FastAPI app, CORS, routes, static mount
│   ├── config.py                # pydantic-settings (.env)
│   ├── llm_router.py            # Groq → Mistral fallback with retry
│   ├── embeddings.py            # Zero-dependency hash embeddings
│   ├── db.py / cache.py         # SQLite (sqlmodel) + in-memory session store
│   ├── models/
│   │   ├── schemas.py           # Pydantic request/response models
│   │   └── db_models.py         # SQLModel tables (jobs, scan history, PRs)
│   ├── routes/
│   │   ├── onboard.py           # /onboard/async, /ask, /trace_flow, /start_here, /blast_radius, /explain_file
│   │   ├── jobs.py              # /jobs/submit, /jobs/{id}/status (polling)
│   │   ├── integration.py       # /graph, /scan_report, /explain_repo
│   │   ├── history.py           # /scan_history (save + fetch)
│   │   ├── autofix.py           # /autofix/estimate, /autofix/run, /autofix/prs
│   │   └── github_webhook.py    # GitHub App connect/disconnect/webhook
│   ├── graph/
│   │   ├── graph_builder.py     # Build dep graph from parsed imports
│   │   ├── python_parser.py     # AST-based Python parser
│   │   ├── js_parser.py         # Regex-based JS/TS parser
│   │   └── blast_radius.py      # Transitive impact analysis
│   ├── ingestion/
│   │   ├── repo_loader.py       # Git clone + file traversal
│   │   ├── chunker.py           # LangChain code-aware chunking
│   │   └── vector_store.py      # ChromaDB build/retrieval
│   ├── chains/                  # LLM chains (label, merge, flow-trace, start-here)
│   ├── agents/                  # Autofix pipeline (triage, fix, verify, PR)
│   ├── integrations/            # GitHub App auth, Sheets logging
│   └── tools/                   # LangChain tools (file, search, scrape)
├── data/
│   ├── chroma_db/               # Persistent vector stores
│   ├── repos/                   # Cloned repo temp dirs
│   └── codeatlas.db             # SQLite (jobs, history)
├── static/                      # Built frontend (production, generated by build:static)
├── pyproject.toml + uv.lock     # Backend deps (uv)
└── requirements.txt             # Pinned export (used only as fallback)

frontend/
├── app/
│   ├── layout.tsx                # Root layout, metadata + favicons
│   ├── page.tsx                  # Home page (hero + sections)
│   ├── workspace/page.tsx        # Workspace page (graph + panels)
│   ├── github/callback/page.tsx  # GitHub App OAuth callback
│   └── globals.css               # Tailwind v4 + shadcn + theme
├── components/
│   ├── hero.tsx                  # URL/upload input with example repo buttons
│   ├── processing-screen.tsx     # SSE progress modal
│   ├── site-header.tsx / site-footer.tsx
│   ├── how-it-works.tsx / features.tsx / live-preview.tsx
│   └── codeatlas/
│       ├── workspace.tsx         # Layout: TopBar + GraphCanvas + RightPanel
│       ├── top-bar.tsx           # Header + agent activity bar
│       ├── graph/
│       │   ├── graph-canvas.tsx  # Interactive React Flow graph (~1350 lines)
│       │   ├── node-popover.tsx  # File details popover on click
│       │   └── tech-stack-strip.tsx
│       └── panel/
│           ├── right-panel.tsx   # Tabbed chat/scan/explain panel
│           ├── chat-tab.tsx      # AI chat with RAG
│           ├── scan-tab.tsx      # Security scan with export (JSON/CSV/TXT/PDF)
│           └── explain-tab.tsx   # Repo summary cards
└── lib/codeatlas/
    ├── types.ts                  # TypeScript interfaces
    ├── api.ts                    # Session-aware API wrappers
    ├── context.tsx               # React context + global store
    └── client.ts                 # HTTP client + SSE reader + graph mapper
```

## Key Design Decisions

| Decision | Rationale |
|---|---|
| **Polling for onboarding** | `/onboard/async` returns a job id; frontend polls `/jobs/{id}/status` for progress during the multi-step pipeline (clone → chunk → graph → label) |
| **Groq + Mistral fallback** | Groq is fast with a generous free tier; Mistral catches auth/rate-limit failures transparently |
| **Hash embeddings** | SHA-256-based 128-dim embeddings with zero dependencies or API calls |
| **Two-level graph** | Module overview (circular) → focus drill-down (grid) prevents overwhelming users with hundreds of nodes |
| **SQLite + in-memory cache** | Jobs, scan history and PRs persist in SQLite (`data/codeatlas.db`); hot sessions cached in memory |
| **Hash-based route matching** | Python uses AST; JS uses regex — simpler but less robust for complex patterns |
| **Heuristic health scan** | File count ratios + regex pattern matching (not a real SAST tool) — lightweight O(1) per file |
| **Single binary deploy** | Backend serves built frontend as static files; one uvicorn process runs everything |

## API Endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/health` | Health check (also the Render `healthCheckPath`) |
| GET | `/health/llm` | Health check + active LLM provider |
| POST | `/onboard/async` | Start background onboarding job, returns `job_id` |
| POST | `/jobs/submit` | Submit a repo job (alternate entrypoint) |
| GET | `/jobs/{job_id}/status` | Poll job progress / result |
| POST | `/graph` | Get stored dependency graph |
| POST | `/scan_report` | Code health scan (grade, metrics, issues) |
| POST | `/explain_repo` | 5 summary bullet points about the repo |
| POST | `/ask` | RAG-based Q&A with vector search |
| POST | `/trace_flow` | LLM-narrated forward execution trace |
| POST | `/start_here` | Goal-guided reading path through the graph |
| POST | `/blast_radius` | Transitive dependency impact (BFS depth ≤ 10) |
| POST | `/explain_file` | LLM one-paragraph file explanation |
| GET/POST | `/scan_history` | Fetch / save scan reports per repo |
| POST | `/autofix/estimate` | Estimate an autofix run |
| POST | `/autofix/run` | Run the autofix pipeline |
| GET | `/autofix/prs/{repo}` | List autofix PRs for a repo |
| POST | `/github/connect` `/github/disconnect` | Link / unlink GitHub App |
| GET | `/github/connection/{repo}` | Connection status for a repo |
| POST | `/github/webhook` | GitHub App webhook receiver |

## Tech Stack

**Backend**: FastAPI, LangChain, Groq, Mistral, ChromaDB, GitPython
**Frontend**: Next.js 16, React 19, React Flow (@xyflow/react), Tailwind CSS v4, Framer Motion
