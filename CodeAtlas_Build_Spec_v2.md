# CodeAtlas — Build Spec v2 (Reliability Fix + Features + UI/UX Guide)

## READ THIS FIRST — Rules for whoever (OpenCode) executes this spec

1. **Do NOT push to GitHub / do NOT run `git push`** at any point. Local commits are fine if needed, but nothing gets pushed remotely unless explicitly told to.
2. **Do NOT hallucinate file structure.** Two pages already exist, built via v0.dev:
   - **Page A — Landing page**: hero ("Understand any codebase in minutes, not weeks"), Repo URL / Upload zip input, "Onboard Repository" CTA, example repo chips (vercel/next.js, fastapi/fastapi, psf/requests, pallets/flask).
   - **Page B — Workspace page**: top bar (repo path, "Onboard Another Repo", branch selector, avatar) → left "Repository" panel (file/dependency counts, STACK badge, graph canvas with zoom/fullscreen/lock controls) → right panel with tab row: **Chat / Scan Report / Explain Repo**.
   Before creating any new page, check if the feature actually needs a new route or if it fits as a new tab / new component inside Page B. Default to extending Page B unless there's a clear reason not to (stated explicitly in this doc where relevant).
3. **API keys**: currently only Groq and Mistral (both free tier) are available. Read them from environment variables (`GROQ_API_KEY`, `MISTRAL_API_KEY`). If a new provider is added later, read it from a new env var (e.g. `COHERE_API_KEY`) — never hardcode a key, and never block functionality on a key that isn't set yet; feature-detect and fall back gracefully.
4. **No paid APIs.** Everything must run on free-tier providers/limits. Design the retry/fallback/caching logic assuming rate limits will be hit regularly — that's the normal case, not an edge case.
5. If genuinely ambiguous what to build, leave a `// TODO: confirm with Abhi` comment and make the most reasonable choice — do not silently skip a requirement or invent a different one.
6. **Build one file at a time, verify, then move on.** Do not write a large batch of files and debug them all together at the end. For each file: write it → run the relevant check (`tsc --noEmit` / lint for frontend files, `python -m py_compile` or run the relevant test for backend files) → fix any error before starting the next file. This applies to every phase below, not just once at the start.
7. **No deprecated dependencies or APIs.** This is a Next.js 19 project — use the current App Router conventions and currently-recommended data-fetching/server-action patterns, not any Pages Router or older Next.js pattern. Before adding any new npm or pip package, check it's actively maintained (not archived, no deprecation notice on its README/PyPI page) and pin a specific current version rather than `latest`/unpinned. Same applies to LangChain/LangGraph APIs specifically: use the current `Runnable`/LCEL and LangGraph `StateGraph` patterns — do not use older deprecated chain classes (e.g. legacy `LLMChain`-style code) if the installed LangChain version has moved past them; check the installed version's own docs before writing agent code.
8. After finishing each numbered feature in Part 2, do a quick smoke test of that feature specifically before starting the next one — don't leave integration testing for the very end.
9. **No login/signup, no user accounts.** The app stays fully open — anyone can onboard a repo without an account. Do not add auth screens, session/JWT-for-users, or a `users` table. All data (jobs, scan history, GitHub connections) is keyed by a **repo identifier** (normalized repo URL, or a hash of the uploaded zip), not by a user ID.
10. **Skip formal unit test suites for now.** The smoke-test-per-feature rule above (#8) is enough at this stage — don't spend time writing pytest/vitest suites unless explicitly asked later. Prioritize working, reliable functionality over test coverage right now.

---

## PART 1 — Fix: 500/502 errors + stuck-at-99% on large repos

*(unchanged from prior spec — do this first, before any feature work)*

### Root cause hypothesis, in priority order (verify with logs before assuming)
1. **Synchronous long-running request** — full pipeline (clone/unzip → parse → embed → summarize → graph) runs inside one HTTP request. Large repos exceed platform gateway timeout → 502, even if backend is still working.
2. **Groq free-tier rate limits** — many rapid calls on large repos hit RPM/TPM limits; no retry/backoff means one failure kills the whole pipeline.
3. **Memory pressure (OOM)** — building embeddings for many files at once on a memory-constrained instance can get the process killed mid-request.
4. **Silent SSE failure** — progress UI depends on SSE events; if backend crashes/times out mid-stream, no terminal event ever arrives, so UI sits at 99% forever with no visible error.

### Required fixes
1. **Async job architecture** — submit returns a `job_id` immediately; full pipeline runs as a background task. **Decision (do not deviate): use polling, not SSE, for job status** — frontend calls `GET /jobs/{job_id}/status` every 2 seconds until the job reaches a terminal state (`done`/`failed`). Polling is simpler and more robust than reconnecting SSE by job_id, and avoids the exact silent-failure bug this fix is meant to solve. Reserve SSE for the live chat feature only (Chat tab), where it already works and isn't part of this bug. Hard timeout per job (e.g. 5 min) → mark `failed` with a specific reason, never left hanging.
2. **Batch processing** — process files in small batches (5-10), emit real progress after each batch. Retry each LLM call with exponential backoff on 429/5xx, cap at 3 retries, then mark that single file "skipped" instead of failing the whole scan.
3. **Multi-provider LLM routing layer** (`llm_router.py` or similar, single place to add/remove providers):
   - Chat Q&A → Groq
   - Repo explanation / summarization → Mistral (or fallback)
   - Bug/issue scanning → whichever has headroom, or dedicated key
   - On rate-limit/error, auto-failover to the other provider.
4. **Response caching** — key by `(repo_url or zip_hash, commit_sha)`. Same repo/commit resubmitted → serve cached result instantly.
5. **Size guardrails** — check file count/size up front; large repos get tuned batch size + longer timeout, or a clear "this repo is large, processing may take longer" message instead of silent failure.

### Acceptance criteria
- No bare 500/502 shown to the user, ever — either it completes or fails with a specific, readable reason.
- Progress bar always reaches "done" or "failed", never stuck.
- One bad file doesn't take down the whole scan.
- Same repo/commit resubmitted returns near-instantly from cache.

### Data model — SQLite (new; ChromaDB stays as-is for vectors)
Current backend only persists vectors (ChromaDB). Job records, scan history, GitHub connections, and cache entries need structured storage — add **SQLite**, accessed via **SQLModel** (built on Pydantic + SQLAlchemy — matches the Pydantic-heavy style already in this codebase) with `aiosqlite` for async access. Do not use raw `sqlite3` calls scattered across the codebase — one `db.py`/`models.py` module defines all tables.

No `users` table (per rule #9 — no auth). Every table is keyed by `repo_identifier` (a normalized string: the GitHub URL, or a hash of the uploaded zip's contents — decide one canonical normalization function and reuse it everywhere so the same repo always maps to the same identifier).

Minimum required tables:
- **`jobs`** — `id` (PK, the `job_id`), `repo_identifier`, `job_type` (`onboard` / `scan` / `autofix`), `status` (`pending`/`running`/`done`/`failed`), `progress_current`, `progress_total`, `error_message`, `created_at`, `updated_at`.
- **`scan_history`** — `id` (PK, autoincrement), `repo_identifier`, `health_score`, `complexity_score`, `test_coverage`, `doc_coverage`, `issues_json` (serialized scan report), `scanned_at`. Powers Part 2 #4 (History tab).
- **`github_connections`** — `id` (PK), `repo_identifier`, `installation_id` (from the GitHub App), `github_repo_full_name`, `connected_at`. Powers Part 2 #3.
- **`autofix_prs`** — `id` (PK), `repo_identifier`, `pr_url`, `pr_number`, `issues_fixed_json`, `created_at`. Powers the PR status chip in Part 2 #2.
- **`response_cache`** — `cache_key` (PK, built from `repo_identifier` + commit SHA), `value_json`, `created_at`. Powers the Part 1 #4 caching requirement.

Add to `pyproject.toml` dependencies: `"sqlmodel>=0.0.24"`, `"aiosqlite>=0.20.0"`.

### Deployment notes (Render) — read before implementing persistence
- **SQLite file location matters.** Render's free/starter web service tier has an **ephemeral filesystem** — anything written to local disk (including a SQLite `.db` file, and the existing local ChromaDB persist directory) is wiped on every redeploy or restart, unless a Render **persistent disk** is attached to the service. Check the current Render plan: if there's no persistent disk already attached (the existing ChromaDB data may already be silently resetting on every deploy — worth verifying), either (a) attach a persistent disk (small paid add-on) and point both SQLite and ChromaDB's persist path at it, or (b) accept that data resets on redeploy for now and note this clearly in the README as a known limitation — don't let OpenCode silently assume persistence works without one of these two decisions being made explicitly.
- New env vars from this spec (`GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY`, `GITHUB_WEBHOOK_SECRET`) need to be added in the Render dashboard's Environment settings, same as existing `GROQ_API_KEY`/`MISTRAL_API_KEY` — Abhi will fill in real values later; code should read them via `pydantic-settings` (already a dependency) with clear validation errors if missing, not a silent crash.
- The background job processing (Part 1 #1) should work with FastAPI `BackgroundTasks` for now on Render's single web service — no separate worker service/Redis queue needed yet at this scale. Note this as a deliberate simplicity choice, not an oversight, in case OpenCode is tempted to add Celery/Redis infrastructure that isn't needed yet.

---

## PART 2 — Features (priority order, functionality first — no monetization/tier logic yet)

Build reliability (Part 1) first. Then build features in this order. Each one includes **where it lives in the existing UI** so there's no ambiguity about new pages vs. new components.

### 1. Real progress + status (small but critical, do this right after Part 1)
- Replace the static "AGENT Ready — explore the graph, chat, or run a scan" status bar with real states: `Cloning repo…`, `Analyzing files (12/47)…`, `Building graph…`, `Ready`, `Failed: <reason>`.
- **UI location**: same status bar, top-left of Page B, next to the pulsing status dot. No new component needed — just wire it to the real job status from Part 1.

### 2. Auto-Fix — multi-agent pipeline that opens a real PR
This merges what were previously two separate ideas (in-app diff preview, and GitHub PR integration) into one coherent feature, since the PR itself is the review mechanism — no separate in-app approve/reject UI needed.

**Architecture — a LangGraph pipeline (fits the existing supervisor pattern already used in the backend), 3 agents + 1 non-LLM safety step:**

1. **Triage Agent** — input: the existing scan report. Classifies each issue as `auto_fixable: true/false` with a category and confidence score, via structured (Pydantic) output. Only low-risk categories qualify as fixable: formatting, missing docstrings/type hints, unused imports, obvious null/None checks. Logic-level bugs are always `false` — surfaced to the user, never auto-fixed.
2. **Fix Agent** — input: only the issues Triage marked fixable. Generates an actual code diff per issue, using file content + issue context. Runs through the existing multi-provider router (Part 1, #3) so retries/fallback are inherited for free; issues can be processed in parallel (small concurrency limit, e.g. 3-5 at a time) since each is independent.
3. **Verification step (no LLM call)** — before including a fix in the PR, run a syntax check on the patched file. Use the standard library / well-maintained parser for each language, do not add a heavy new dependency for this: Python → `ast.parse()` (built-in, zero new dependency); JS/TS → the TypeScript compiler API (`ts.createSourceFile` + check for parse errors) since the project already depends on TypeScript for the frontend. If the file's language isn't Python or JS/TS, skip verification for that file and mark it "unverified — manual review recommended" rather than guessing with a parser that isn't set up. If a file fails to parse, drop the fix and mark it "failed — needs manual review" rather than shipping broken code.
4. **PR Agent** — input: all verified fixes. Creates a new branch via the GitHub App installation (same connection as the GitHub integration below), commits each fix (one commit per issue for clean review history), and opens a PR with an auto-generated description that summarizes what was fixed, why, and links back to each original scan issue.

**Trigger**: this pipeline does NOT run automatically. After Triage runs (cheap, fast), show the user a button: `Generate Fix PR (auto-fixes N of M issues)`. Only on click does Fix → Verify → PR proceed. This keeps a human-initiated safety gate before anything touches the repo.

**Job handling**: reuse the async job architecture from Part 1 — this is a multi-step, potentially slow pipeline, so it needs a `job_id`, real progress states (`Triaging…`, `Generating fixes (2/4)…`, `Verifying…`, `Opening PR…`, `Done` / `Failed`), not a blocking request.

- **UI location**: lives inside the existing **Scan Report tab**. Each issue card still gets a lightweight "View Fix" expandable preview (quick look at what would change, using the diff already generated by the Fix Agent) for issues the user wants to inspect individually. The `Generate Fix PR` button sits above the issue list, showing the auto-fixable count once Triage has run. Once a PR is opened, replace that button with a small status chip — `PR #123 opened` — linking out to GitHub. No new page or new top-level tab needed.

### 3. GitHub connection (prerequisite for #2, and for scan-on-push)
- Connect a repo via **GitHub App** (not personal OAuth, not a personal access token) — scoped permissions: `contents: write`, `pull requests: write` only. This single connection powers both the Auto-Fix PR feature above and scan-on-push/PR.
- On new push/PR to a connected repo, auto-run a scan and post a summary comment (health score, top issues) back on the PR.
- **New env vars needed** (add to `.env`, read via `os.environ`, never hardcode): `GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY` (PEM key, the app's identity), `GITHUB_WEBHOOK_SECRET` (to verify incoming push/PR webhook payloads are genuinely from GitHub). Abhi will provide actual values later — code must read from env and fail with a clear startup warning if unset, not crash silently elsewhere.
- **Exact steps the PR Agent follows when opening a PR** (implement in this order, don't improvise a different flow):
  1. Authenticate as the GitHub App using `GITHUB_APP_ID` + `GITHUB_APP_PRIVATE_KEY` to generate a short-lived JWT, then exchange it for an **installation access token** scoped to the specific repo the user connected.
  2. `GET` the repo's default branch and its latest commit SHA.
  3. `POST` a new branch ref (e.g. `codeatlas-fix-<timestamp>`) pointing at that SHA.
  4. For each verified fix, commit the changed file content to the new branch (one commit per issue).
  5. `POST` a pull request from the new branch into the default branch, with a generated title and a description listing each fix and linking back to its scan issue.
  6. Store the returned PR URL/number against the job record so the UI can show the `PR #123 opened` status chip.
- **UI location**: small "Connect to GitHub" toggle near "Onboard Another Repo" in the top bar — not a whole new page. Scan results still render in the existing Scan Report tab; PRs opened by Auto-Fix show up as the status chip described above.

### 4. Scan history / trend view
- Store past scans per repo (health score, complexity, test coverage over time) and show as a simple line chart.
- **UI location**: **new tab** in the existing tab row, alongside Chat / Scan Report / Explain Repo → add **"History"** as a 4th tab. This is the one case where a new top-level UI element is justified, since it's a genuinely distinct view, not a sub-state of an existing one.

### 5. Repo health badge (embed in README)
- Generate a shields.io-style badge/markdown snippet showing the latest health score, linking back to CodeAtlas.
- **UI location**: small "Copy Badge" button inside the Scan Report tab, near the health score card — not a new page.

### 6. Export to Jira/Linear
- One-click convert a scan issue into a ticket.
- **UI location**: small action icon on each issue card in Scan Report, next to where "View Fix" lives — same card, don't fragment the UI.

---

## PART 3 — UI/UX Guide (how OpenCode should style everything new)

### Design tokens — reuse these exactly, do not invent a new palette
Derived from the existing v0.dev-built pages (do not deviate):

| Token | Value | Usage |
|---|---|---|
| `--bg-canvas` | near-black, `#0a0a0c` (not pure `#000`) | page background |
| `--bg-card` | `#131316` – `#16161a` | panels, cards |
| `--border-subtle` | `rgba(255,255,255,0.08)` | card/panel borders — used instead of shadows (shadows don't read on dark backgrounds) |
| `--accent-primary` | indigo/violet, ~`#6366f1` | graph nodes, focused/selected states |
| `--accent-action` | emerald, ~`#10b981` | primary CTAs, active tab underline, "Ready" status dot |
| `--severity-high` | orange, `#f97316` | HIGH severity badges (match existing screenshot exactly, do not use a second red variant — one color per severity level, no ambiguity) |
| `--severity-medium` | amber, ~`#f59e0b` | MEDIUM severity badges |
| `--text-primary` | `#f4f4f5` | headings, primary text |
| `--text-secondary` | `#a1a1aa` | captions, metadata, muted labels |
| Font — UI | Inter or Geist Sans | all interface text |
| Font — code/data | JetBrains Mono or Geist Mono | file names, code, diffs, numeric stats |

### Principles to follow (apply to every new component)
- **One accent per meaning.** Indigo = structural/graph, emerald = action/success/positive state, orange/red = severity/warning. Don't introduce a new color for a new feature — reuse these.
- **Progressive disclosure.** Default views stay sparse (5-9 visible elements). Diffs, history charts, fix previews — all stay collapsed until the user asks. This is why Auto-Fix and Jira export live *inside* existing issue cards rather than as new pages.
- **No shadows — use borders.** Every new card/panel uses `--border-subtle`, same radius as existing cards (check existing CSS for the exact `border-radius` value and match it).
- **Errors/empty states are informative, not vague.** E.g. a failed job shows *why* it failed and what to do next, not just "Error."

### Animation — Framer Motion (frontend is Next.js, so this fits directly)
Use it deliberately, not everywhere. Specific places it earns its keep:
- **Diff preview expand/collapse** in Auto-Fix — smooth height/opacity transition, not an instant snap.
- **Progress bar** — animate width changes smoothly as batches complete (Part 2 #1), so it feels alive rather than jumpy.
- **Tab switching** (Chat/Scan Report/Explain Repo/History) — subtle fade or slide, consistent direction.
- **Graph node focus** (clicking a module) — the existing "click a module to focus on it" interaction should ease into position, not snap instantly.
- Do **not** add motion to things that don't need it (e.g. don't animate every card on every hover) — restraint matters more than density of effects here; over-animating is what makes AI-built UIs look templated.
- Three.js is not needed for this project — the dependency graph is a 2D node graph (React Flow, per existing implementation), not a 3D scene. Skip Three.js entirely unless a specific future feature calls for it.

### Per-feature UI build checklist for OpenCode
For each feature in Part 2, before writing code:
1. Confirm which existing component/tab it extends (stated above for each).
2. Reuse existing card/badge/button components/styles — don't create parallel new ones with slightly different padding/radius/colors.
3. Apply the token table above for any new color usage.
4. Add Framer Motion only where listed above.
5. Test at the existing breakpoint(s) the app already supports before considering it done.

---

## Suggested execution order
1. Part 1, items 1-5 (reliability fix) — test on a genuinely large public repo (500+ files) before moving on.
2. Part 2, #1 (real progress status) — quick win, validates Part 1 end-to-end.
3. Part 2, #3 (GitHub connection) — build this before #2, since Auto-Fix's PR Agent depends on it.
4. Part 2, #2 (Auto-Fix multi-agent pipeline) — core differentiator, the main "wow" feature.
5. Part 2, #4 (History tab).
6. Part 2, #5 and #6 (badge, Jira export) — smaller, do last.
7. Monetization/subscription tiers — deliberately **not** in this spec. Revisit once the above is working end-to-end.
