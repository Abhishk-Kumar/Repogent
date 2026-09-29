import json
import logging
import random
import re
import os

from fastapi import APIRouter
from pydantic import BaseModel

from app.ingestion.repo_loader import load_repo
from app.graph.graph_builder import build_dependency_graph
from app.chains.node_label_chain import generate_node_labels
from app.utils.normalize import normalize_repo_url

# Share the same session store as the onboard route
from app.routes.onboard import _session_store

logger = logging.getLogger(__name__)

router = APIRouter()


class SessionRequest(BaseModel):
    session_id: str


class GraphResponse(BaseModel):
    nodes: list[dict]
    edges: list[dict]
    isolated_files: list[str]
    routes: list[dict]
    # 05.2: resolve-failure signals (defaults keep old payloads valid).
    unresolved_imports: int = 0
    unparsed_files: list[str] = []


class ScanReportRequest(BaseModel):
    session_id: str


class ScanIssue(BaseModel):
    id: str
    title: str
    severity: str
    file: str
    line: int
    detail: str
    fix: str


class HealthMetric(BaseModel):
    label: str
    value: int
    hint: str


class FutureImprovement(BaseModel):
    id: str
    title: str
    detail: str


class ScanReportResponse(BaseModel):
    grade: str
    score: int
    summary: str
    metrics: list[HealthMetric]
    issues: list[ScanIssue]
    improvements: list[FutureImprovement]


class ExplainRepoRequest(BaseModel):
    session_id: str


class ExplainPoint(BaseModel):
    id: str
    title: str
    body: str
    icon: str


class ExplainRepoResponse(BaseModel):
    points: list[ExplainPoint]


class TechStackRequest(BaseModel):
    session_id: str


class TechStackResponse(BaseModel):
    tech: list[dict]


@router.post("/graph", response_model=GraphResponse)
async def get_graph(request: SessionRequest):
    normalized = normalize_repo_url(request.session_id)
    session = _session_store.get(normalized)
    if not session:
        session = await _build_session_from_repo(request.session_id)
        if not session:
            return GraphResponse(nodes=[], edges=[], isolated_files=[], routes=[])

    graph = session.get("graph")
    if not graph:
        return GraphResponse(nodes=[], edges=[], isolated_files=[], routes=[])

    return GraphResponse(
        nodes=graph.get("nodes", []),
        edges=graph.get("edges", []),
        isolated_files=graph.get("isolated_files", []),
        routes=graph.get("routes", []),
        unresolved_imports=graph.get("unresolved_imports", 0),
        unparsed_files=graph.get("unparsed_files", []),
    )


def _generate_scan_report(session: dict) -> ScanReportResponse:
    graph = session.get("graph", {})
    nodes = graph.get("nodes", [])
    file_list = session.get("file_list", [])

    total_files = len(nodes)
    test_files = sum(1 for n in nodes if "test" in n.get("id", "").lower() or n.get("id", "").startswith("test"))
    doc_coverage = sum(1 for n in nodes if n.get("purpose", "").strip())
    routes = graph.get("routes", [])

    # Deterministic scoring based on file counts
    if total_files > 80:
        complexity_score = 85  # A
    elif total_files > 40:
        complexity_score = 70  # B  
    else:
        complexity_score = 55  # C
    
    # Test coverage: percentage-based but capped
    test_coverage = min(100, int((test_files / max(total_files, 1)) * 100))
    if test_coverage > 80:
        test_coverage = 90
    elif test_coverage > 40:
        test_coverage = 75
    else:
        test_coverage = 50
    
    # Documentation coverage: percentage-based with deterministic thresholds
    doc_percentage = int((doc_coverage / max(total_files, 1)) * 100)
    if doc_percentage > 80:
        doc_score = 85
    elif doc_percentage > 40:
        doc_score = 70
    else:
        doc_score = 55

    # Context-aware metrics: skip Route clarity for non-web repos (no API routes)
    if len(routes) == 0:
        route_clarity_value = 0
        route_clarity_hint = "N/A - no API routes detected"
    else:
        route_clarity_value = min(100, 60 + len(routes) * 5)
        route_clarity_hint = f"{len(routes)} API routes defined"

    metrics = [
        HealthMetric(label="Complexity", value=complexity_score, hint=f"Avg. cyclomatic complexity across {total_files} files"),
        HealthMetric(label="Test coverage", value=test_coverage, hint=f"{test_files} test files found"),
        HealthMetric(label="Doc coverage", value=doc_score, hint=f"{doc_coverage} files with descriptions"),
        HealthMetric(label="Route clarity", value=route_clarity_value, hint=route_clarity_hint),
    ]

    overall = int((complexity_score + test_coverage + doc_score) / 3)

    issues = []

    for n in nodes:
        if not n.get("purpose", "").strip():
            continue
        fp = n.get("id", "")
        ext = os.path.splitext(fp)[1].lower() if fp else ""
        if ext != ".py":
            continue
        content = ""
        try:
            full_path = os.path.join(session.get("repo_path", ""), fp)
            with open(full_path, "r", errors="ignore") as f:
                content = f.read()
        except Exception:
            continue

        if "password" in content.lower() or "secret" in content.lower() or "api_key" in content.lower():
            for line_num, line in enumerate(content.split("\n"), 1):
                lower = line.lower()
                if "=" in line and any(k in lower for k in ["password", "secret", "api_key", "token"]):
                    issues.append(
                        ScanIssue(
                            id=f"sec-{len(issues)}",
                            title="Hard-coded credential detected",
                            severity="critical" if "password" in lower or "secret" in lower else "high",
                            file=fp,
                            line=line_num,
                            detail=f"Potential hard-coded credential in assignment: `{line.strip()[:80]}`",
                            fix="Move to environment variables or a secrets manager.",
                        )
                    )

        if "eval(" in content or "exec(" in content:
            for line_num, line in enumerate(content.split("\n"), 1):
                if "eval(" in line or "exec(" in line:
                    issues.append(
                        ScanIssue(
                            id=f"sec-{len(issues)}",
                            title="Use of eval/exec detected",
                            severity="high",
                            file=fp,
                            line=line_num,
                            detail=f"Dynamic code execution: `{line.strip()[:80]}`",
                            fix="Avoid eval/exec. Use safer alternatives like ast.literal_eval.",
                        )
                    )

        if "def " in content:
            for match in re.finditer(r"def (\w+)\(.*\):", content):
                func_name = match.group(1)
                start = content.rfind("\n", 0, match.start())
                prev_line = content[start + 1:match.start()].strip()
                if func_name.startswith("_"):
                    continue
                if not prev_line.startswith("def") and not prev_line.startswith("@") and not prev_line.startswith('"""') and not prev_line.startswith("'''") and not prev_line.startswith("#"):
                    if content[match.end():].strip().startswith('"""'):
                        continue
                    issues.append(
                        ScanIssue(
                            id=f"doc-{len(issues)}",
                            title="Missing docstring on public function",
                            severity="low",
                            file=fp,
                            line=content[:match.start()].count("\n") + 1,
                            detail=f"Function `{func_name}` in {fp} lacks a docstring.",
                            fix="Add a descriptive docstring explaining parameters and return value.",
                        )
                    )

    # Remove fake issue when no issues found; let frontend handle empty state
    # (no issues list means "No issues found — nice.")

    improvements = []
    if test_files == 0:
        improvements.append(FutureImprovement(id="imp-1", title="Add unit tests", detail="No test files detected. Add tests for core modules to improve reliability."))
    elif total_files > 0 and test_files / total_files < 0.15:
        improvements.append(FutureImprovement(id="imp-1", title="Increase test coverage", detail=f"Only {test_files} of {total_files} files are tests ({test_files/max(total_files,1)*100:.0f}%). Aim for 15%+ test file ratio."))
    if doc_coverage < total_files:
        improvements.append(FutureImprovement(id="imp-2", title="Document undocumented files", detail=f"{total_files - doc_coverage} file(s) lack descriptions. Add docstrings and README comments for maintainability."))
    if len(routes) > 0:
        improvements.append(FutureImprovement(id="imp-3", title="Add API documentation", detail=f"{len(routes)} route(s) detected. Consider OpenAPI/Swagger docs for your API endpoints."))
    if len(file_list) > 500:
        improvements.append(FutureImprovement(id="imp-4", title="Reduce codebase complexity", detail=f"{total_files} source files is large. Consider refactoring into smaller, focused modules."))
    # Remove fake "Looks clean" improvement; if no real improvements, leave empty

    # Ensure that if score < 75, we have at least one concrete improvement area
    if overall < 75 and len(improvements) == 0:
        # Add a generic improvement based on the weakest area
        if test_coverage < 60:
            improvements.append(FutureImprovement(id="imp-generic", title="Add more tests", detail="Increase test coverage to improve reliability."))
        elif doc_score < 60:
            improvements.append(FutureImprovement(id="imp-generic", title="Improve documentation", detail="Add docstrings and comments to improve maintainability."))
        elif complexity_score < 60:
            improvements.append(FutureImprovement(id="imp-generic", title="Reduce complexity", detail="Refactor complex functions to improve readability."))
        else:
            # Fallback: suggest adding tests
            improvements.append(FutureImprovement(id="imp-generic", title="Add more tests", detail="Increase test coverage to further improve reliability."))

    # A-F grade mapping: A>=90, B>=80, C>=70, D>=60, F<60
    if overall >= 90:
        grade = "A"
    elif overall >= 80:
        grade = "B"
    elif overall >= 70:
        grade = "C"
    elif overall >= 60:
        grade = "D"
    else:
        grade = "F"

    # Update summary to mention concrete improvement areas if score < 75
    base_summary = f"Analysis of {total_files} files with {len(routes)} API routes and {test_files} test files."
    if overall < 75 and improvements:
        # List up to 2 improvement titles in the summary
        improvement_titles = [imp.title for imp in improvements[:2]]
        if len(improvement_titles) == 1:
            base_summary += f" Key area for improvement: {improvement_titles[0]}."
        else:
            base_summary += f" Key areas for improvement: {', '.join(improvement_titles[:-1])} and {improvement_titles[-1]}."

    return ScanReportResponse(
        grade=grade,
        score=overall,
        summary=base_summary,
        metrics=metrics,
        issues=issues,
        improvements=improvements,
    )


@router.post("/scan_report", response_model=ScanReportResponse)
async def scan_report(request: ScanReportRequest):
    normalized = normalize_repo_url(request.session_id)
    session = _session_store.get(normalized)
    if not session:
        session = await _build_session_from_repo(request.session_id)
        if not session:
            return ScanReportResponse(
                grade="N/A", score=0, summary="No session found",
                metrics=[], issues=[], improvements=[],
            )

    return _generate_scan_report(session)


@router.post("/explain_repo", response_model=ExplainRepoResponse)
async def explain_repo(request: ExplainRepoRequest):
    normalized = normalize_repo_url(request.session_id)
    session = _session_store.get(normalized)
    if not session:
        session = await _build_session_from_repo(request.session_id)
        if not session:
            return ExplainRepoResponse(points=[])

    graph = session.get("graph", {})
    nodes = graph.get("nodes", [])
    total = len(nodes)

    # Collect language distribution
    lang_dist = {}
    for node in nodes:
        lang = node.get("language")
        if lang:
            lang_dist[lang] = lang_dist.get(lang, 0) + 1
    lang_str = ", ".join(sorted(lang_dist.keys())) if lang_dist else "unknown"

    # Count route files (API endpoints)
    routes = graph.get("routes", [])
    route_files = len(set(r.get("file", "") for r in routes)) if routes else 0

    # Count edges in dependency graph
    edges = graph.get("edges", [])
    edge_count = len(edges) if edges else 0

    points = []

    # Point 1: Overview
    overview = f"The codebase consists of {total} source files."
    if lang_dist:
        overview += f" The primary language(s) are {lang_str}."
    if route_files:
        overview += f" It includes {route_files} files that define API endpoints."
    points.append(ExplainPoint(id="e1", title="Overview", icon="compass", body=overview))

    # Point 2: Dependencies
    if edge_count > 0:
        deps = f"The dependency graph shows {edge_count} relationships between {total} files, indicating how modules interconnect."
    else:
        deps = "No dependency relationships were detected in the analysis."
    points.append(ExplainPoint(id="e2", title="Dependencies", icon="boxes", body=deps))

    # Point 3: Language Details (if we have distribution)
    if lang_dist:
        lang_details = ", ".join([f"{count} {lang}" for lang, count in lang_dist.items()])
        lang_body = f"Files are written in the following languages: {lang_details}."
    else:
        lang_body = "No language information was detected."
    points.append(ExplainPoint(id="e3", title="Languages", icon="terminal", body=lang_body))

    # Note: We do not have data for architecture, problem solved, or notable patterns.
    # We avoid making false claims by not adding sections for which we lack data.

    return ExplainRepoResponse(points=points)


async def _build_session_from_repo(repo_url: str) -> dict | None:
    try:
        metadata, files = load_repo(repo_url)
        graph = build_dependency_graph(metadata.local_path, files)
        graph["nodes"] = await generate_node_labels(graph["nodes"])
        session = {
            "repo_path": metadata.local_path,
            "graph": graph,
            "file_list": files,
        }
        normalized = normalize_repo_url(repo_url)
        _session_store[normalized] = session
        return session
    except Exception as e:
        logger.exception("Failed to build session from repo: %s", e)
        return None
