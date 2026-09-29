import os
import logging

from app.graph.python_parser import parse_python_imports, parse_python_defs, find_flask_fastapi_routes
from app.graph.js_parser import parse_js_imports, find_express_routes

logger = logging.getLogger(__name__)

SUPPORTED_EXTENSIONS = {".py", ".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs", ".mts"}

IGNORE_DIRS = {".git", "node_modules", "__pycache__", "venv", ".venv", "dist", "build", ".next"}


def _get_top_folder(file_path: str) -> str:
    parts = file_path.replace("\\", "/").split("/")
    return parts[0] if parts else ""


def _classify_file(file_path: str) -> str:
    ext = os.path.splitext(file_path)[1].lower()
    if ext == ".py":
        return "python"
    if ext in (".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs", ".mts"):
        return "js"
    return "other"


def build_dependency_graph(repo_root: str, file_list: list[str]) -> dict:
    nodes = []
    edges = []
    isolated_files = []
    file_index = {}
    routes = []

    for fp in file_list:
        ext = os.path.splitext(fp)[1].lower()
        if ext not in SUPPORTED_EXTENSIONS:
            continue

        rel_path = os.path.relpath(fp, repo_root) if os.path.isabs(fp) else fp
        folder = _get_top_folder(rel_path)
        lang = _classify_file(rel_path)
        defs = {"functions": [], "classes": []}

        if lang == "python":
            defs = parse_python_defs(fp)
            file_routes = find_flask_fastapi_routes(fp)
            for r in file_routes:
                r["file"] = rel_path
                routes.append(r)
        elif lang == "js":
            file_routes = find_express_routes(fp)
            for r in file_routes:
                r["file"] = rel_path
                routes.append(r)

        node = {
            "id": rel_path,
            "label": os.path.basename(rel_path),
            "folder": folder,
            "language": lang,
            "functions": defs["functions"],
            "classes": defs["classes"],
            "purpose": "",
        }
        nodes.append(node)
        file_index[rel_path] = node

    edge_id_counter = 0
    # 05.2 diagnostics: distinguish "genuinely zero imports" from
    # "couldn't resolve/parse" so the UI never shows fake zeros.
    unresolved_imports = 0
    unparsed_files: list[str] = []
    for fp in file_list:
        ext = os.path.splitext(fp)[1].lower()
        if ext not in SUPPORTED_EXTENSIONS:
            continue

        rel_path = os.path.relpath(fp, repo_root) if os.path.isabs(fp) else fp
        stats: dict = {}

        if ext == ".py":
            imports = parse_python_imports(fp, repo_root, stats)
        elif ext in (".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs", ".mts"):
            imports = parse_js_imports(fp, repo_root, stats)
        else:
            imports = []

        unresolved_imports += stats.get("unresolved", 0)
        if stats.get("unparsed"):
            unparsed_files.append(rel_path)

        for imp in imports:
            resolved = imp.get("resolved_path")
            if resolved and resolved != rel_path and resolved in file_index:
                edges.append({
                    "id": f"e{edge_id_counter}",
                    "source": rel_path,
                    "target": resolved,
                })
                edge_id_counter += 1

    has_outgoing = set()
    has_incoming = set()
    for edge in edges:
        has_outgoing.add(edge["source"])
        has_incoming.add(edge["target"])

    for node in nodes:
        nid = node["id"]
        if nid not in has_outgoing and nid not in has_incoming:
            isolated_files.append(nid)

    result = {
        "nodes": nodes,
        "edges": edges,
        "isolated_files": isolated_files,
        "routes": routes,
        "unresolved_imports": unresolved_imports,
        "unparsed_files": unparsed_files,
    }

    logger.info(
        "Graph built: %d nodes, %d edges, %d isolated, %d routes, "
        "%d unresolved imports, %d unparsed files",
        len(nodes), len(edges), len(isolated_files), len(routes),
        unresolved_imports, len(unparsed_files),
    )

    return result
