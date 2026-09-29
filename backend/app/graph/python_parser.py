import ast
import os
import logging

logger = logging.getLogger(__name__)

STDLIB_PACKAGES = {
    "os", "sys", "re", "json", "math", "time", "datetime", "collections",
    "itertools", "functools", "pathlib", "typing", "uuid", "hashlib",
    "logging", "argparse", "subprocess", "threading", "multiprocessing",
    "io", "base64", "abc", "enum", "dataclasses", "inspect", "pprint",
    "random", "statistics", "string", "textwrap", "types", "warnings",
    "weakref", "copy", "decimal", "fractions", "numbers", "contextlib",
    "importlib", "pkgutil", "platform", "shutil", "tempfile", "glob",
    "fnmatch", "linecache", "pickle", "shelve", "marshal", "smtplib",
    "email", "http", "urllib", "xml", "html", "cgi", "webbrowser",
    "asyncio", "signal", "socket", "ssl", "select", "selectors",
    "unittest", "doctest", "traceback", "pdb", "profile", "cProfile",
    "tokenize", "token", "keyword", "ast", "compileall", "dis",
    "builtins", "__future__",
}


def _is_stdlib_or_third_party(module_name: str) -> bool:
    top = module_name.split(".")[0]
    if top in STDLIB_PACKAGES:
        return True
    if top.startswith("_"):
        return True
    return False


# 05.1 diagnosis (kept here per pack: answer in a code comment):
# - Parser: stdlib `ast` (no new dependency — fast, keeps the ~35s budget).
# - Relative imports (`from .`, `from ..pkg`): HONORED via node.level —
#   FIXED 05.2. Previously level was ignored and single-dot imports only
#   worked by accident (file_dir fallback); `from ..pkg import m` and
#   `from . import sibling_pkg` could resolve to the wrong file.
# - Barrel files (__init__.py re-exports): YES (pkg/__init__.py candidates).
# - tsconfig paths: N/A (Python). Extensionless: N/A. CJS require /
#   dynamic import(): N/A (Python has no dynamic-import syntax in scope;
#   importlib.import_module strings are not resolved — logged as unresolved).
# - Third-party vs internal: anything not in the STDLIB list is treated as
#   *potentially* internal and probed on disk; misses are logged as
#   unresolved (never fake edges).
def _resolve_import(node: ast.Import | ast.ImportFrom, file_path: str, repo_root: str) -> list[dict]:
    resolved = []
    file_dir = os.path.dirname(os.path.abspath(file_path))

    # Honor explicit relative-import level: base = file_dir ascended (level-1).
    level = getattr(node, "level", 0) or 0
    base_dir = file_dir
    for _ in range(max(level - 1, 0)):
        base_dir = os.path.dirname(base_dir)

    if isinstance(node, ast.Import):
        for alias in node.names:
            module = alias.name
            if _is_stdlib_or_third_party(module):
                continue
            resolved_module = _try_resolve(module, base_dir, repo_root)
            if resolved_module:
                resolved.append(resolved_module)
    elif isinstance(node, ast.ImportFrom):
        module = node.module or ""
        if level == 0 and _is_stdlib_or_third_party(module):
            return []
        for alias in node.names:
            if alias.name == "*":
                # `from x import *` — resolve the package/module itself.
                if module:
                    pkg_path = _try_resolve(module, base_dir, repo_root)
                    if pkg_path:
                        resolved.append(pkg_path)
                continue
            name = alias.name
            resolved_module = _try_resolve(f"{module}.{name}", base_dir, repo_root) if module else _try_resolve(name, base_dir, repo_root)
            if resolved_module:
                resolved.append(resolved_module)
            else:
                if module:
                    pkg_path = _try_resolve(module, base_dir, repo_root)
                    if pkg_path:
                        resolved.append(pkg_path)

    return resolved


def _try_resolve(module: str, file_dir: str, repo_root: str) -> dict | None:
    parts = module.split(".")
    candidates = []

    # 1. Check relative to file_dir
    rel_path = os.path.join(file_dir, *parts[:-1], parts[-1] + ".py")
    candidates.append(rel_path)
    rel_init = os.path.join(file_dir, *parts, "__init__.py")
    candidates.append(rel_init)

    # 2. Check relative to repo_root
    alt_base = os.path.join(repo_root, *parts[:-1], parts[-1] + ".py")
    candidates.append(alt_base)
    alt_init = os.path.join(repo_root, *parts, "__init__.py")
    candidates.append(alt_init)

    # 3. Check relative to src/ directory if present
    src_dir = os.path.join(repo_root, "src")
    if os.path.isdir(src_dir):
        candidates.append(os.path.join(src_dir, *parts[:-1], parts[-1] + ".py"))
        candidates.append(os.path.join(src_dir, *parts, "__init__.py"))

    for candidate in candidates:
        candidate = os.path.normpath(candidate)
        if os.path.isfile(candidate):
            try:
                relative = os.path.relpath(candidate, repo_root)
                return {"source": module, "resolved_path": relative}
            except ValueError:
                return None

    return None


def parse_python_imports(
    file_path: str, repo_root: str, stats: dict | None = None
) -> list[dict]:
    """Parse imports; optionally record diagnostics into stats dict.

    stats["unparsed"] is set True when the file can't be read/parsed;
    stats["unresolved"] counts candidate-internal imports that failed to
    resolve (05.2 — feeds the UI warning state, never fake zeros).
    """
    try:
        with open(file_path, "r", encoding="utf-8", errors="replace") as f:
            content = f.read()
    except OSError as e:
        logger.warning("Failed to read python file %s: %s", file_path, e)
        if stats is not None:
            stats["unparsed"] = True
        return []

    try:
        tree = ast.parse(content)
    except SyntaxError as e:
        logger.warning("Syntax error parsing %s: %s", file_path, e)
        if stats is not None:
            stats["unparsed"] = True
        return []

    imports = []
    for node in ast.walk(tree):
        if isinstance(node, (ast.Import, ast.ImportFrom)):
            resolved = _resolve_import(node, file_path, repo_root)
            if not resolved:
                # Check if this was a candidate internal import that failed
                level = getattr(node, "level", 0) or 0
                if isinstance(node, ast.Import):
                    for alias in node.names:
                        if not _is_stdlib_or_third_party(alias.name):
                            logger.info("Unresolved Python import: %s in %s", alias.name, file_path)
                            if stats is not None:
                                stats["unresolved"] = stats.get("unresolved", 0) + 1
                elif isinstance(node, ast.ImportFrom):
                    mod = node.module or ""
                    if level > 0 or (mod and not _is_stdlib_or_third_party(mod)):
                        logger.info(
                            "Unresolved Python import: %s%s in %s",
                            "." * level, mod, file_path,
                        )
                        if stats is not None:
                            stats["unresolved"] = stats.get("unresolved", 0) + 1
            imports.extend(resolved)

    return imports


def parse_python_defs(file_path: str) -> dict:
    result = {"functions": [], "classes": []}
    try:
        with open(file_path, "r", encoding="utf-8", errors="replace") as f:
            content = f.read()
    except OSError as e:
        logger.warning("Failed to read python file for defs %s: %s", file_path, e)
        return result

    try:
        tree = ast.parse(content)
    except SyntaxError as e:
        logger.warning("Syntax error parsing defs %s: %s", file_path, e)
        return result

    for node in ast.walk(tree):
        if isinstance(node, ast.FunctionDef):
            result["functions"].append(node.name)
        elif isinstance(node, ast.ClassDef):
            result["classes"].append(node.name)

    return result


def find_flask_fastapi_routes(file_path: str) -> list[dict]:
    routes = []
    try:
        with open(file_path, "r", encoding="utf-8", errors="replace") as f:
            content = f.read()
    except OSError as e:
        logger.warning("Failed to read python file for routes %s: %s", file_path, e)
        return routes

    try:
        tree = ast.parse(content)
    except SyntaxError as e:
        logger.warning("Syntax error parsing routes %s: %s", file_path, e)
        return routes

    for node in ast.walk(tree):
        if isinstance(node, ast.FunctionDef):
            for decorator in node.decorator_list:
                if isinstance(decorator, ast.Call) and hasattr(decorator.func, "attr"):
                    if decorator.func.attr in ("get", "post", "put", "delete", "patch"):
                        method = decorator.func.attr.upper()
                        if decorator.args:
                            try:
                                path = ast.literal_eval(decorator.args[0])
                                routes.append({
                                    "method": method,
                                    "path": path,
                                    "function": node.name,
                                })
                            except (ValueError, TypeError):
                                pass

    return routes
