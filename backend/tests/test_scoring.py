"""11.1 — score/grade computation tests (03.5).

Context-aware metrics: Route clarity N/A for non-web repos; summaries name
concrete improvements when score < 75; A–F grade mapping.
"""
from app.routes.integration import _generate_scan_report


def _node(id_: str, purpose: str = "Does things.") -> dict:
    return {"id": id_, "purpose": purpose}


def test_non_web_repo_route_clarity_na():
    session = {
        "graph": {"nodes": [_node("a.py"), _node("b.py")], "edges": [], "routes": []},
        "file_list": ["a.py", "b.py"],
        "repo_path": "",
    }
    report = _generate_scan_report(session)
    route_metric = next(m for m in report.metrics if m.label == "Route clarity")
    assert route_metric.value == 0
    assert "N/A" in route_metric.hint


def test_low_score_summary_names_improvement():
    session = {
        "graph": {"nodes": [_node("a.py", ""), _node("b.py", "")], "edges": [], "routes": []},
        "file_list": ["a.py", "b.py"],
        "repo_path": "",
    }
    report = _generate_scan_report(session)
    assert report.score < 75
    assert report.grade in {"D", "F"}
    assert len(report.improvements) > 0
    assert any(imp.title in report.summary for imp in report.improvements[:2])


def test_healthy_repo_scores_b_or_better():
    nodes = [_node(f"m{i}.py") for i in range(100)]
    nodes += [_node(f"test_{i}.py") for i in range(90)]
    session = {
        "graph": {
            "nodes": nodes,
            "edges": [],
            "routes": [{"file": "api.py", "method": "GET", "path": "/x"}],
        },
        "file_list": [n["id"] for n in nodes],
        "repo_path": "",
    }
    report = _generate_scan_report(session)
    assert report.score >= 80
    assert report.grade in {"A", "B"}
