# CodeAtlas / Repogent — Audit & Fix Plan

## How to use this document

Work through the phases in order. Within each phase, work through the numbered
items in order — later items sometimes depend on earlier ones being fixed
first (e.g. session key normalization must land before you touch caching).

For every item:
1. Open the referenced file(s) and confirm the issue still matches the
   description below (line numbers may have drifted).
2. Fix it using the specified approach, or a clearly better one if you find
   one — but do not silently skip an item. If you decide not to fix something
   as written, say so explicitly in your output with a one-line reason.
3. Remove any code that becomes dead as a result of the fix.
4. Do not introduce new silent failure modes — see "Error handling standard"
   below before touching any try/except.

Do not do a general-purpose refactor pass, rename things for style, or
reorganize file/folder structure. This is a correctness and dead-code pass,
not a rewrite. Keep diffs as small as they can be while still fully fixing
each item.

## Scope decision (read this first)

This project is scoped to **Python and JS/TS-family repos only**
(`.py`, `.js`, `.jsx`, `.ts`, `.tsx`). Go, Java, Rust, and other languages
are explicitly **out of scope** for this pass — do not add parsers for them.

Instead, fix the current *lie*: `repo_loader.py`'s `Language_Extentions`
currently detects and counts Go/Java files (`languages_detected`,
`file_count`) even though nothing downstream can process them. Make the
language-detection list match `SUPPORTED_EXTENSIONS` in `graph_builder.py`
exactly, so the tool never claims to understand a language it can't graph,
embed, or scan. If a repo contains unsupported files, they should be counted
in a separate `unsupported_files` bucket the UI can show honestly (e.g.
"14 Go files detected — not included in graph/chat/scan"), not silently
dropped and not silently counted as if they were processed.

## Error handling standard (apply everywhere in this pass)

Every place currently catching an exception and returning an empty
result with **no log line** must get a log line at minimum
(`logger.warning(...)` with the file path and exception). This applies in
particular to:
- `repo_loader.py` (file size / OSError skips)
- `chunker.py` (read failures)
- `python_parser.py` (read/parse failures)
- `js_parser.py` (read failures)
- `integration.py` (scan file read failures)

Do not make these fail the whole job — keep them non-fatal — but they must
be visible in logs, and where the count of skipped files is non-trivial
(e.g. more than a few, or a significant fraction of the repo), surface a
count to the job progress response so the frontend can show it. A user
should never see "empty graph" or "clean scan" with zero indication that
files were silently excluded.

---

## Phase 1 — Fix repo-dependent hard failures

These are the issues most likely responsible for "works on some repos, not
others." Fix these first and re-test against a handful of real, non-trivial
repos before moving to Phase 2.

### 1.1 — Align language detection with actual support
**Files:** `backend/app/ingestion/repo_loader.py`, `backend/app/graph/graph_builder.py`

`Language_Extentions` in `repo_loader.py` currently includes `.go`, `.java`
alongside the supported set. Restrict it to match `SUPPORTED_EXTENSIONS`
(`.py`, `.js`, `.jsx`, `.ts`, `.tsx`). Add a separate `unsupported_files`
count/list to `RepoMetaData` so the pipeline can report "N files detected
but not supported" honestly instead of silently dropping them from
`languages_detected`/`file_count` while implying full coverage.

### 1.2 — Normalize repo identity across session store, cache, and vector store
**Files:** `backend/app/routes/onboard.py`, `backend/app/routes/integration.py`,
`backend/app/routes/jobs.py`, `backend/app/cache.py`, frontend `client.ts`

Right now `_session_store` is keyed by the raw `repo_url` string from the
request, while `cache.py`'s `build_cache_key` hashes a *normalized* URL.
`https://github.com/owner/repo`, `github.com/owner/repo`, and
`github.com/owner/repo.git` currently produce three different sessions but
one cache entry (or vice versa depending on call site), causing "session not
found" errors and unnecessary re-cloning.

Fix:
- Write one shared `normalize_repo_url(url: str) -> str` function (strip
  protocol, trailing slash, `.git` suffix, lowercase the host) and put it
  somewhere both session and cache code import from — don't duplicate it.
- Use the normalized identifier as the key everywhere: `_session_store`,
  `build_cache_key`, and the ChromaDB path (`data/chroma_db/<hash>/`).
- Confirm the frontend always sends the URL as typed (don't normalize
  client-side) — normalization should happen once, server-side, so it's
  consistent regardless of how the user pastes the URL.

### 1.3 — Add fallback import resolution for common non-flat layouts
**Files:** `backend/app/graph/python_parser.py`, `backend/app/graph/js_parser.py`

Current Python resolution assumes imports map directly onto the filesystem
from repo root. Add a fallback: if direct resolution fails, also try
resolving relative to a `src/` directory if one exists at repo root (the
common `src/` layout). This does not need to handle every packaging edge
case — just the common one that silently breaks a large fraction of real
repos.

Current JS/TS resolution only handles relative imports (`./`, `../`). Add
support for the most common alias pattern: if `tsconfig.json` or
`jsconfig.json` exists at repo root and defines a `paths` mapping (most
commonly `"@/*": ["./src/*"]` or similar), load it and use it to resolve
non-relative imports that match a configured alias before giving up and
classifying the import as external. Don't attempt full webpack/bundler
resolution — just this one common case.

Where resolution still fails after these fallbacks, keep the current
behavior (edge dropped, node stays isolated) but make sure it's logged at
INFO with the unresolved import string, so a future pass can see how much
residual resolution failure exists on real repos.

---

## Phase 2 — Fix intermittent reliability failures

These don't depend on which repo you use — they show up over time /
across restarts, which will look exactly like "flaky" or "random" repo
behavior if untraced.

### 2.1 — Guard against embedding space mismatch
**File:** `backend/app/embeddings.py`, `backend/app/ingestion/vector_store.py`

`get_embeddings()` currently always returns the hash-based fallback —
`_HuggingFaceAPIEmbeddings` is fully implemented but never used. Two things:

- For this pass, since only the hash embedder is actually live, this is not
  an active bug — but leaving the dead class in place with no safeguard is a
  landmine. Either (a) remove the unused `_HuggingFaceAPIEmbeddings` class
  entirely if there's no near-term plan to use it, or (b) if you want to keep
  it for later, write the embedder identifier (e.g. `"hash-v1"`) into the
  ChromaDB collection metadata at build time, and check it matches at query
  time in `get_vector_store`, refusing/rebuilding on mismatch. Don't leave a
  fully-wired but silently-inconsistent second code path sitting in the repo.
- Pick (a) or (b) — don't leave it half-wired as it is now.

### 2.2 — Handle vector store directory loss gracefully
**File:** `backend/app/ingestion/vector_store.py`, `backend/app/routes/onboard.py`

If `data/chroma_db/<hash>/` is missing at chat time (e.g. wiped by an
ephemeral filesystem on redeploy) but the session store still thinks
onboarding succeeded, `get_vector_store` returns `None` and chat silently
degrades to "No vector index available" with no path to recovery short of
a full re-onboard the user isn't prompted to do. Make the "no vector store"
response explicitly tell the frontend to prompt a re-onboard, rather than
just answering without context as if that were expected behavior.

### 2.3 — Wire up repo cleanup
**File:** `backend/app/ingestion/repo_loader.py`, `backend/app/routes/jobs.py`

`cleanup_repo()` is fully implemented but never called. Call it in a
`finally` block after `_run_onboard` completes, whether the job succeeded or
failed, so `/tmp/onboarding_agent_*` doesn't accumulate. Confirm nothing
downstream (session store, later requests) still needs the cloned path on
disk after processing — if it does, only clean up on terminal states where
you're sure it's no longer needed, and note that assumption in a comment.

---

## Phase 3 — Correctness and trust fixes

These don't cause outright failures but produce wrong or misleading output,
which matters a lot for a tool whose entire value proposition is "trust what
it tells you about your code."

### 3.1 — Fix blast radius entry-point bug
**File:** `backend/app/graph/blast_radius.py` (~line 27)

`if file_path not in incoming: return {"found": False}` incorrectly treats
legitimate entry-point files (files with no incoming edges, e.g. `main.py`,
route handlers) as not found. Check membership in the full node list, not
just the `incoming` edges map.

### 3.2 — Fix flow trace to follow branches
**File:** `backend/app/graph/flow_trace_chain.py` (`_walk_forward`, ~line 62-77)

Currently only `next_files[0]` is followed, silently ignoring any function
that calls more than one thing. At minimum, either (a) trace all outgoing
edges up to a small branching factor and depth limit and present it as a
tree rather than a single path, or (b) if a linear narrative is a hard
product requirement, explicitly note in the output when branching was
truncated ("this function also calls X, Y — not shown") rather than
silently presenting a partial trace as complete.

### 3.3 — Fix LLM provider routing for async calls
**File:** `backend/app/llm_router.py` (`call_llm_with_retry`, ~174-238)

`_preferred_provider` correctly maps chat→Groq, explain→Mistral, but the
async wrapper used by every actual caller ignores `purpose` and just uses
whatever provider was last successfully initialized — meaning if Groq fails
once, everything (including explain/label calls that should prefer Mistral)
sticks to Mistral from then on. Thread `purpose` through
`call_llm_with_retry` and use `_preferred_provider` for each call rather
than a sticky last-used provider.

### 3.4 — Remove randomized scan scoring
**File:** `backend/app/routes/integration.py` (~line 121-123)

`random.randint(5,20)` / `random.randint(10,25)` jitter added to test
coverage and doc coverage scores means the same repo gets a different grade
on every re-scan. Remove the jitter. If the underlying metrics are too thin
to be meaningful without padding (e.g. "doc coverage" is really just "LLM
purpose field non-empty," which is nearly always true), that's worth fixing
at the metric level rather than papering over with randomness — replace
"doc coverage" with an actual check for docstring presence in the parsed
AST (you already have the AST from `python_parser.py`; reuse it) rather than
the current proxy.

### 3.5 — Fix inverted "route clarity" metric
**File:** `backend/app/routes/integration.py` (~line 129)

`min(100, 60 + len(routes) * 5)` rewards having *more* routes with a higher
score, which is backwards for a "clarity" metric — a repo with 8 routes
scores higher than one with 3. Either remove this metric or replace it with
something that actually reflects clarity (e.g. route naming consistency,
presence of path parameters documentation) rather than raw count.

### 3.6 — Add commit SHA to cache key
**File:** `backend/app/cache.py`, `backend/app/routes/jobs.py`

`build_cache_key` accepts an optional `commit_sha` but no caller passes it,
so pushing a new commit to an already-onboarded repo silently serves stale
cached results. If the backend currently has no way to fetch the latest
commit SHA before cloning, add a lightweight call for it (a shallow
`git ls-remote` or GitHub API HEAD lookup) and include it in the cache key
for both onboarding and scan caching.

---

## Phase 4 — Dead code and doc/behavior mismatches

Do this phase last, after the behavior above is correct, since some of this
depends on decisions made in Phase 2/3 (e.g. whether `_HuggingFaceAPIEmbeddings`
is kept or removed).

- Remove `reset_embeddings()` and `reset_llm()` in `embeddings.py` /
  `llm_router.py` if genuinely unused — confirm with a repo-wide reference
  search first, don't assume from this doc alone.
- Resolve `_HuggingFaceAPIEmbeddings` per the decision made in 2.1 (remove
  entirely, or wire it up properly with metadata versioning).
- Update the README once behavior is fixed, not before:
  - Onboarding is polling (`POST /onboard/async` + `GET /jobs/{id}/status`),
    not SSE as currently described. Fix the description or, if SSE is
    actually wanted, that's a separate feature project — don't claim it
    until it exists.
  - "Code-aware chunking" should note it applies to the supported language
    set, not all files.
  - Confirm the "scan-on-push" webhook feature description matches what
    `github_webhook.py` actually does; adjust the spec/README to match
    reality either way.

---

## Verification checklist (run after each phase, not just at the end)

- [ ] Onboard at least 3 real repos that use a `src/` layout or JS path
      aliases (not toy repos) and confirm the dependency graph has a
      reasonable edge count, not mostly-isolated nodes.
- [ ] Onboard a repo containing a significant amount of Go or another
      unsupported language and confirm the UI clearly states those files
      weren't processed, rather than showing an empty graph with no
      explanation.
- [ ] Onboard the same repo twice using different URL formats
      (`https://github.com/x/y`, `github.com/x/y`, `github.com/x/y.git`)
      and confirm it resolves to the same session/cache entry.
- [ ] Restart the backend process between onboarding and chatting on the
      same repo, confirm chat still works (vector store reload) or fails
      with a clear, actionable message — not silent degraded answers.
- [ ] Run the security scan twice on an unchanged repo and confirm the
      grade is identical both times.
- [ ] Click into an entry-point file (e.g. `main.py`) in blast radius view
      and confirm it's found.
- [ ] Push a new commit to an already-onboarded test repo, re-run
      onboarding, confirm it reflects the new commit rather than serving
      stale cached results.

## Explicitly out of scope for this pass

- Adding Go/Rust/Java/other language parsers.
- General code style refactor, renaming, or reorganizing folder structure.
- Full bundler-aware import resolution (webpack configs beyond
  `tsconfig`/`jsconfig` paths, monorepo workspace resolution).
- SSE-based onboarding streaming (documentation should be corrected to
  match current polling behavior instead).
- Authentication/multi-user support.
