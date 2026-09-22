# COMPLETE PROJECT STATUS REPORT — CodeAtlas

---

## PART 1 — RELIABILITY FIXES

### 1. Async job architecture (job_id, background polling)
**Status**: IMPLEMENTED but with a dangling legacy path

**Files**: `backend/app/routes/jobs.py`, `backend/app/routes/onboard.py:124-128`, `frontend/lib/codeatlas/client.ts:253-304`

**How it works**: `/onboard/async` creates a `Job` row in SQLite with status `running`, fires `asyncio.create_task(_run_job)`, returns `{job_id}` immediately. Frontend polls `GET /jobs/{job_id}/status` every 2s via `startPollingJob`. The `_run_onboard` function runs clone→chunk→vector→graph→labels→finalize as a background task, updating `progress_current`/`progress_message` after each step. **Submission is now non-blocking.**

**BUT**: The legacy synchronous `/onboard` endpoint (old SSE streaming path at `onboard.py:32-121`) is **still mounted and functional** — it runs the entire pipeline inside the HTTP request, bypassing the async job system entirely. The `ProcessingScreen` component uses the new polling path, so the default UI flow is correct, but the old endpoint is dead code that could be hit directly.

**Hard timeout**: The spec calls for a 5-minute hard timeout per job. `config.py` has `job_hard_timeout_seconds: int = 300`, but **it's never actually enforced** — the `_run_job` task has no timeout wrapping.

### 2. Retry/backoff logic
**Status**: IMPLEMENTED twice — around individual LLM calls, NOT around the pipeline

**Files**: `backend/app/llm_router.py:85-152` (`call_with_retry`), `backend/app/llm.py:62-127` (`call_llm_with_retry`)

**How it works**: Both files have near-duplicate `call_with_retry` functions. Each wraps a **single LLM invocation** with exponential backoff (initial 0.5s, doubles, cap 4s, max 2 attempts by default). They detect `429`/rate-limit, `5xx`, `401`/auth errors, and provider-failover on certain errors. The retry is **around the LLM call**, not around the pipeline — if `_run_onboard` throws at step 3, there's no retry of the earlier steps.

**Critical problem**: Two separate retry implementations:
- `app/llm.py` — used by old routes (`/ask`, `/explain_file`), config via `settings.mistral_retry_*`
- `app/llm_router.py` — used by new agents (triage, fix), same config but different code path

Both are active. Which one a given feature uses depends on which file it imports from. The old `app/llm.py` also has its own separate `get_llm()` / provider-switching, so there's duplicate provider management too.

### 3. Job deduplication
**Status**: IMPLEMENTED correctly

**Files**: `backend/app/routes/jobs.py:47-76`

**How it works**: Per-repo `asyncio.Lock` in `_REPO_LOCKS` dict. Before creating a new job, checks for existing `pending`/`running` jobs for the same `repo_identifier`. If found, returns the existing `job_id` instead of creating a new one. This works as specified.

### 4. Multi-provider LLM routing (Groq ↔ Mistral)
**Status**: PARTIALLY IMPLEMENTED — per-task-type routing is scaffolded but non-functional

**Files**: `backend/app/llm_router.py`

**How it works**: The `RoutePurpose` enum exists (`CHAT`, `EXPLAIN`, `SCAN`, `TRIAGE`, `FIX`), and `get_llm(purpose)` accepts a `purpose` parameter. But **`purpose` is completely ignored** — `get_llm()` always returns the single `_current_provider` instance regardless of what purpose is passed. Provider failover works (if Groq auth fails, it switches to Mistral), but the spec's design ("Chat Q&A → Groq, Repo explanation → Mistral, Bug scanning → whichever has headroom") is **not implemented**. Both providers are wired in, but there's only ever one active provider at a time for all task types.

### 5. Response caching
**Status**: SCAFFOLDED — module exists but NOT wired into any execution path

**Files**: `backend/app/cache.py`, `backend/models/db_models.py:68-72`

**How it works**: `build_cache_key()`, `get_cached()`, `set_cache()` all exist with correct SQLite access. The `response_cache` table exists. But **nobody calls them**. Not in `submit_job`, not in `_run_onboard`, not in `_run_scan`, not in any route handler. Resubmitting the same repo always re-processes from scratch.

### 6. SQLite data model
**Status**: FULLY IMPLEMENTED — all 5 tables match spec

**File**: `backend/app/models/db_models.py`, `backend/app/db.py`

**Actual schema as it exists in code**:
| Table | Columns | Matches spec? |
|---|---|---|
| `jobs` | `id` (PK, str), `repo_identifier`, `job_type`, `status`, `progress_current`, `progress_total`, `progress_message`, `error_message`, `result_json`, `created_at`, `updated_at` | Yes, plus extra `progress_message` and `result_json` |
| `scan_history` | `id` (PK, auto), `repo_identifier`, `health_score`, `complexity_score`, `test_coverage`, `doc_coverage`, `issues_json`, `scanned_at` | Yes |
| `github_connections` | `id` (PK, auto), `repo_identifier`, `installation_id`, `github_repo_full_name`, `connected_at` | Yes |
| `autofix_prs` | `id` (PK, auto), `repo_identifier`, `pr_url`, `pr_number`, `issues_fixed_json`, `created_at` | Yes |
| `response_cache` | `cache_key` (PK), `value_json`, `created_at` | Yes |

Note: `jobs` has extra columns `progress_message` and `result_json` not in the spec but necessary for the polling UI. `scan_history` has extra `complexity_score` not explicitly listed in the spec but referenced in the History chart.

---

## PART 2 — FEATURES

### 1. Real progress status in UI
**Status**: IMPLEMENTED and working

**Files**: `frontend/components/codeatlas/top-bar.tsx:43-105` (ActivityBar), `frontend/components/processing-screen.tsx`

**How it works**: The `ActivityBar` reads `jobProgress` from `CodeAtlasContext`, which is updated by the polling loop in `ProcessingScreen`. Shows step-by-step messages: `Cloning repository...`, `Chunking files...`, `Building vector store...`, `Building dependency graph...`, `Generating AI labels...`, `Finalizing report...`, `Ready`. Progress bar animates smoothly. Failed states show `Failed: <reason>`. The status dot pulses indigo during active, shows emerald check on complete, orange triangle on warning.

**UI location**: `TopBar` → `ActivityBar` — a thin bar below the main nav, visible on the workspace page. Currently functional.

### 2. Auto-Fix pipeline (Triage → Fix → Verify → PR)
**Status**: All 4 agent nodes exist but LangGraph is NOT wired in — it's plain sequential code

**Files**:
| Agent | File | Status |
|---|---|---|
| Triage | `backend/app/agents/triage_agent.py` | Implemented — LLM classifies issues by category (7 types). `FIXABLE_CATEGORIES = {formatting, docstring, unused_import, null_check}`. Falls back gracefully on LLM error. |
| Fix | `backend/app/agents/fix_agent.py` | Implemented — generates code diff via LLM with Pydantic output `FixResult`. Returns `None` on failure. |
| Verification | `backend/app/agents/verifier.py` | Implemented — `ast.parse()` for `.py`, `subprocess run npx tsc` for JS/TS, skips other languages. `apply_patch` does string replacement with `difflib` fallback. |
| PR Agent | `backend/app/agents/pr_agent.py` | Implemented — creates branch, commits per-file, opens PR via GitHub API. Uses full GitHub App auth flow (JWT → installation token). |
| Orchestrator | `backend/app/agents/autofix_pipeline.py` | Implemented — sequential async function calls, no LangGraph |
| Routes | `backend/app/routes/autofix.py` | `POST /autofix/estimate` and `POST /autofix/run` — the latter creates a background job |
| UI | `frontend/.../panel/scan-tab.tsx:256-364` | `AutoFixSection` component — shows fixable count, "Generate Fix PR" button, polls for status |

**Not wired**: `langgraph>=0.4.0` is in `pyproject.toml` but **zero LangGraph imports exist anywhere in the codebase**. The pipeline is orchestrated by `run_autofix_pipeline()` calling functions in sequence with `await`. No `StateGraph`, no nodes/edges, no graph compilation — it's all plain Python function calls.

**Issues**:
- Triage runs **twice** — once in `/autofix/estimate` (frontend calls it on mount), then again inside `/autofix/run`
- Fix generation is **sequential**, not concurrent (spec says 3-5 at a time)
- The frontend polls `GET /jobs/{job_id}/status` every 2s, but the autofix pipeline only updates job progress at coarse granularity (1/5, 2/5, etc.)
- No "View Fix" expandable diff preview per issue card (spec says there should be one)

### 3. GitHub App connection
**Status**: PARTIALLY IMPLEMENTED — full backend API + GitHub API integration exist, but frontend flow is a stub

**Files**: `backend/app/routes/github_webhook.py`, `backend/app/integrations/github.py`, `frontend/components/codeatlas/github-connect.tsx`, `frontend/app/api/github/callback/route.ts`

**How it works**: The "Connect GitHub" button in the top bar opens `https://github.com/apps/repogent-ai/installations/new` in a new tab. After installation, GitHub redirects to `/api/github/callback`, which parses `installation_id`, POSTs it to `POST /github/connect`, and redirects to the workspace.

**What's broken/stubbed**:
1. **Hardcoded app name**: `repogent-ai` — this GitHub App may not exist
2. **No connection state feedback**: After the callback, the frontend still shows "Connect GitHub" — there's no logic to detect completion and switch to "Connected" state. The user has to click the button again to see "Connected"
3. **Cookie expiry**: `github_connect_repo` cookie set to 300s — expires in 5 minutes
4. **Webhook handlers are empty**: `_handle_push` and `_handle_pr` in `github_webhook.py:123-131` just log the event — no scan is actually triggered
5. **Missing env vars warning**: The spec says to warn on startup if `GITHUB_APP_ID`/`GITHUB_APP_PRIVATE_KEY`/`GITHUB_WEBHOOK_SECRET` are missing — this is NOT done. The app just uses empty string defaults

**What works**: The full GitHub API integration in `integrations/github.py` — JWT creation, installation token exchange, get_default_branch, get_latest_commit_sha, create_branch, commit_file, create_pr, post_pr_comment — all implemented and ready.

### 4. History tab
**Status**: IMPLEMENTED

**Files**: `frontend/components/codeatlas/panel/history-tab.tsx`, `backend/app/routes/history.py`

**UI**: 4th tab in the right panel with Activity icon. Shows:
- "Latest Scan" card with 2x2 grid of Health Score, Complexity, Test Coverage, Doc Coverage values
- Trend badges (up/down arrows) comparing to previous scan
- Animated SVG line charts for each metric (using `<motion.path>`)

**How it works**: Fetches `GET /scan_history/{repo_url}` to get all stored scans. Scan results are saved automatically when the Scan Report tab loads (`scan-tab.tsx:380` calls `saveScanHistory`). Empty state shows "No scan history yet" with an Activity icon. Good progressive disclosure.

### 5. Badge export (README badge)
**Status**: IMPLEMENTED but URL is wrong

**File**: `frontend/components/codeatlas/panel/scan-tab.tsx:38-41` (copyBadge function)

**UI**: Small `Share2` icon button appears on hover over the grade circle in the `HealthHeader` component. Copies a shields.io badge markdown snippet to clipboard.

**Issue**: The badge links to `https://codeatlas.app` which does not exist yet. The badge image URL is `https://img.shields.io/badge/health-${grade}-${color}` which is correct but not dynamic.

### 6. Jira/Linear export
**Status**: IMPLEMENTED — URL-based, no real API integration

**File**: `frontend/components/codeatlas/panel/scan-tab.tsx:127-153` (in IssueRow)

**UI**: Two small icons on each issue card — a Jira icon (checkmark in circle) and a Linear icon (box). Clicking opens a URL in a new tab.

**How it works**:
- Jira: Opens `https://codeatlas.atlassian.net/secure/CreateIssueDetails!init.jspa?summary=...&description=...`
- Linear: Opens `https://linear.new?title=...&description=...`

**Issue**: The Jira URL is hardcoded to `codeatlas.atlassian.net` which likely doesn't exist. Linear URL uses the generic `linear.new` creator which should work.

---

## UI/UX — EVERY PAGE, TAB, AND COMPONENT

### Page A: Landing page (`/`)
| Component | What it renders | Status |
|---|---|---|
| `ParticleBackground` | Canvas-based animated node/edge particle effect | Background only |
| `SiteHeader` | Logo "CodeAtlas" + accent "Atlas" + nav links | Visible, static |
| `Hero` | "Understand any codebase in minutes, not weeks" headline, input card (Repo URL / Upload zip tabs), CTA "Onboard Repository", 4 example repo chips (vercel/next.js, fastapi/fastapi, psf/requests, pallets/flask) | Visible, functional |
| `HowItWorks` | 3-step explanation cards | Visible, static |
| `Features` | Feature grid with icons | Visible, static |
| `LivePreview` | Animated preview/demo | Visible, animated |
| `SiteFooter` | Footer with inline "Onboard" link | Visible, functional link |
| `ProcessingScreen` | Modal overlay: progress bar, step list with check/spinner/dot states, error state with orange card | Visible during onboarding, fully functional |

### Page B: Workspace page (`/workspace`)
| Component | What it renders | Status |
|---|---|---|
| **TopBar** | | |
| ├ Logo + repo name | "CodeAtlas" with indigo accent, repo path badge (e.g. `vercel/next.js`) | Visible |
| ├ GitHubConnect | "Connect GitHub" button → opens GitHub App install page | Visible, partially functional (see above) |
| ├ "Onboard Another Repo" link | Links back to `/` | Visible, functional |
| ├ Branch selector | Shows "main" hardcoded, no actual switching | Visible, non-functional — always "main" |
| ├ Avatar circle | Gradient circle (indigo→emerald) | Visual only |
| └ ActivityBar | "Agent" label + status dot + progress message. States: active (pulsing indigo), complete (emerald check), warning (orange alert), failed (orange text) | Visible, functional |
| **GraphCanvas** | | |
| ├ Breadcrumb bar | "Repository" / module name / subfolder navigation with file/dep counts and "Exit Focus" button | Functional |
| ├ Module overview | Orbit-layout module cards with file/folder counts, cross-module import links | Functional |
| ├ Focused module view | Container with subfolder + file nodes in grid layout, external dependency door | Functional |
| ├ TechStackStrip | Horizontal tech badge strip | Visible |
| ├ Controls | React Flow zoom controls | Functional |
| └ NodePopover | Floating detail card on file click | Functional |
| **RightPanel** | Tab row with sliding content: | |
| ├ Chat tab | Chat messages, suggestion chips, text input with send button. Empty state: "No repository loaded" | Functional |
| ├ Scan Report tab | Health grade card with copy-badge button, metric bars, issues grouped by severity with expandable details, Jira/Linear icons, fix suggestion, AutoFix section, Export dropdown (JSON/CSV/TXT/PDF), Future Improvements | Fully implemented |
| ├ Explain Repo tab | 5 styled explanation cards (What it does, How it's architected, Problem it solves, Key technologies, Notable patterns) with icons and step numbers | Functional |
| └ History tab | Latest scan 2x2 metric grid with trend badges, SVG line charts for each metric over time. Empty state: "No scan history yet" | Functional |

### Design token deviations from spec (Part 3)
1. **`--accent-primary` (#6366f1 indigo)**: Not defined as a CSS variable. The CSS has `--primary: oklch(0.88 0 0)` — a light gray, not indigo. Indigo is only used via hardcoded `bg-indigo-500/*` utility classes and the graph canvas's `MODULE_PALETTE`.
2. **`--accent-action` (#10b981 emerald)**: Not defined. Emerald `#34d399` (lighter than spec's `#10b981`) is **hardcoded inline** in button classes like `bg-[#34d399]` — not using a token.
3. **Graph canvas uses hardcoded colors**: `graph-canvas.tsx` defines its own `COLORS` object (lines 27-42) with raw hex values instead of CSS variable references.
4. **`--border-subtle` (`rgba(255,255,255,0.08)`)**: Not defined — `--border` is `oklch(1 0 0 / 9%)` which is close but not exactly matching.
5. **Font**: Geist Sans + Geist Mono — matches spec correctly.
6. **Severity colors**: Match spec — orange for HIGH, amber for MEDIUM — correct.

---

## GENERAL

### Deviations from CodeAtlas_Build_Spec_v2.md
1. **LangGraph not used** (spec Part 2 #2: "Architecture — a LangGraph pipeline"). Despite `langgraph>=0.4.0` being a dependency, the auto-fix pipeline uses plain sequential async function calls. No `StateGraph`, no graph nodes, no LangGraph runtime.
2. **Per-task-type LLM routing not implemented** (spec Part 1 #3: "Chat Q&A → Groq, Repo explanation → Mistral..."). `RoutePurpose` enum is defined but ignored.
3. **Response caching not wired** (spec Part 1 #4: "Same repo/commit resubmitted → serve cached result instantly"). Cache module exists but nothing calls it.
4. **No concurrency in fix generation** (spec Part 2 #2: "3-5 at a time"). Fixes are generated one at a time in a for loop.
5. **No "View Fix" expandable diff preview** (spec Part 2 #2: "Each issue card still gets a lightweight View Fix expandable preview"). Issue rows only show the textual fix suggestion, not a diff.
6. **Old synchronous SSE endpoint left functional** (spec Part 1 #1 says to remove/replace). `/onboard` still works and is a blocking request.
7. **No pipeline/step retry** (spec Part 1 #2 describes retry around the whole scan path). Retry is only around individual LLM calls.
8. **No hard timeout enforcement** (spec Part 1 #1: "Hard timeout per job (e.g. 5 min) → mark failed"). Config value exists but is never enforced.

### TODO: confirm with Abhi comments
**None found** in source code. The only occurrence is in the spec document itself (line 12).

### Currently broken or known not to work
1. **Response caching** — module exists, zero integration
2. **Per-task-type LLM routing** — enum exists, logic absent
3. **GitHub connect flow** — hardcoded app name, no feedback, no auto-refresh of connected state
4. **Branch selector** — always shows "main", no mechanism to list/switch branches
5. **Webhook handlers** — `_handle_push` and `_handle_pr` are empty stubs
6. **Badge URL** — links to `codeatlas.app` (not deployed)
7. **Jira export URL** — hardcoded to `codeatlas.atlassian.net`
8. **Missing GITHUB_* env var warnings** — silently defaults to empty strings
9. **Duplicate LLM modules** — `app/llm.py` and `app/llm_router.py` overlap, causing potential confusion about which code path any given feature uses
10. **Triage runs twice** on autofix flow (estimate + run both call `triage_issues`)
11. **No diff preview** for auto-fix issues despite spec requirement
12. **`_run_scan` called synchronously inside background task** — `_generate_scan_report` does file I/O and string processing, blocking the event loop
13. **`startOnboardingSSE` in client.ts** — legacy SSE path still available in frontend code as a public export, though not called anywhere in the current UI
