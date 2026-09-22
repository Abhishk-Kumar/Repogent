import os
import re
import json
import logging

logger = logging.getLogger(__name__)

IMPORT_PATTERNS = [
    re.compile(r'import\s+[\s\S]*?\s+from\s+["\'](.+?)["\']'),
    re.compile(r'const\s+\w+\s*=\s*require\(["\'](.+?)["\']\)'),
    re.compile(r'let\s+\w+\s*=\s*require\(["\'](.+?)["\']\)'),
    re.compile(r'var\s+\w+\s*=\s*require\(["\'](.+?)["\']\)'),
    re.compile(r'import\(["\'](.+?)["\']\)'),
    re.compile(r'export\s+\{[\s\S]*?\}\s+from\s+["\'](.+?)["\']'),
    re.compile(r'export\s+\*\s+from\s+["\'](.+?)["\']'),
]

JS_EXTENSIONS = {".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs"}

NODE_BUILTINS = {
    "fs", "path", "os", "http", "https", "util", "events", "stream",
    "crypto", "buffer", "child_process", "cluster", "dns", "net",
    "tls", "url", "querystring", "zlib", "assert", "console", "module",
    "process", "timers", "string_decoder", "readline", "repl", "vm",
    "worker_threads", "perf_hooks", "async_hooks", "v8", "inspector",
    "diagnostics_channel", "domain", "punycode", "tty",
}


def _strip_json_comments(text: str) -> str:
    # Remove single line comments // ...
    text = re.sub(r'//.*', '', text)
    # Remove multi-line comments /* ... */
    text = re.sub(r'/\*[\s\S]*?\*/', '', text)
    return text


def _load_tsconfig_paths(repo_root: str) -> tuple[str, dict[str, list[str]]]:
    """Load baseUrl and paths mapping from tsconfig.json or jsconfig.json."""
    for config_name in ("tsconfig.json", "jsconfig.json"):
        config_path = os.path.join(repo_root, config_name)
        if os.path.isfile(config_path):
            try:
                with open(config_path, "r", encoding="utf-8", errors="replace") as f:
                    content = _strip_json_comments(f.read())
                    data = json.loads(content)
                    compiler_options = data.get("compilerOptions", {})
                    base_url = compiler_options.get("baseUrl", ".")
                    paths = compiler_options.get("paths", {})
                    if paths:
                        return base_url, paths
            except Exception as e:
                logger.warning("Failed to parse %s: %s", config_path, e)
    return ".", {}


def _is_external_or_builtin(module_spec: str) -> bool:
    if not module_spec.startswith(".") and not module_spec.startswith("/"):
        return True
    return False


def _normalize_relative(module_spec: str, file_dir: str) -> str:
    result = os.path.normpath(os.path.join(file_dir, module_spec))
    return result


def _try_extension(base_path: str) -> str | None:
    for ext in JS_EXTENSIONS:
        candidate = base_path + ext
        if os.path.isfile(candidate):
            return candidate
    if os.path.isdir(base_path):
        for ext in JS_EXTENSIONS:
            candidate = os.path.join(base_path, "index" + ext)
            if os.path.isfile(candidate):
                return candidate
    return None


def _resolve_with_paths(module_spec: str, repo_root: str, base_url: str, paths: dict[str, list[str]]) -> str | None:
    """Try to resolve module_spec using tsconfig/jsconfig paths mappings."""
    base_dir = os.path.normpath(os.path.join(repo_root, base_url))
    for alias_pattern, target_list in paths.items():
        if alias_pattern.endswith("/*"):
            prefix = alias_pattern[:-2]
            if module_spec.startswith(prefix + "/") or module_spec == prefix:
                sub_path = module_spec[len(prefix):].lstrip("/")
                for target in target_list:
                    target_prefix = target.replace("/*", "")
                    candidate_base = os.path.normpath(os.path.join(base_dir, target_prefix, sub_path))
                    resolved = _try_extension(candidate_base)
                    if resolved and os.path.isfile(resolved):
                        return resolved
        elif alias_pattern == module_spec:
            for target in target_list:
                candidate_base = os.path.normpath(os.path.join(base_dir, target))
                resolved = _try_extension(candidate_base)
                if resolved and os.path.isfile(resolved):
                    return resolved
    return None


def _resolve_js_import(module_spec: str, file_path: str, repo_root: str, base_url: str = ".", paths: dict = None) -> dict | None:
    paths = paths or {}

    # Check for relative import
    if not _is_external_or_builtin(module_spec):
        file_dir = os.path.dirname(os.path.abspath(file_path))
        base_path = _normalize_relative(module_spec, file_dir)
        resolved = _try_extension(base_path)

        if resolved and os.path.exists(resolved):
            try:
                relative = os.path.relpath(resolved, repo_root)
                return {"source": module_spec, "resolved_path": relative, "external": False}
            except ValueError:
                return None
        return None

    # Try alias path resolution from tsconfig/jsconfig
    if paths:
        resolved = _resolve_with_paths(module_spec, repo_root, base_url, paths)
        if resolved and os.path.exists(resolved):
            try:
                relative = os.path.relpath(resolved, repo_root)
                return {"source": module_spec, "resolved_path": relative, "external": False}
            except ValueError:
                return None

    top = module_spec.split("/")[0].split("@")[0] if module_spec.startswith("@") else module_spec.split("/")[0]
    if top in NODE_BUILTINS:
        return None

    # Check if this might have been an attempted path alias that failed
    if module_spec.startswith("@/") or module_spec.startswith("~/"):
        logger.info("Unresolved JS/TS path alias import: %s in %s", module_spec, file_path)

    return {"source": module_spec, "resolved_path": None, "external": True}


def parse_js_imports(file_path: str, repo_root: str) -> list[dict]:
    try:
        with open(file_path, "r", encoding="utf-8", errors="replace") as f:
            content = f.read()
    except OSError as e:
        logger.warning("Failed to read JS/TS file %s: %s", file_path, e)
        return []

    base_url, paths = _load_tsconfig_paths(repo_root)

    imports = []
    seen = set()

    for pattern in IMPORT_PATTERNS:
        for match in pattern.finditer(content):
            module_spec = match.group(1).strip()
            if module_spec in seen:
                continue
            seen.add(module_spec)
            resolved = _resolve_js_import(module_spec, file_path, repo_root, base_url, paths)
            if resolved:
                imports.append(resolved)

    return imports


EXPRESS_ROUTE_PATTERNS = [
    re.compile(r'\.(get|post|put|delete|patch|all)\s*\(\s*["\'](.+?)["\']'),
    re.compile(r'router\.(get|post|put|delete|patch|all)\s*\(\s*["\'](.+?)["\']'),
    re.compile(r'(?:app|router)\.route\s*\(\s*["\'](.+?)["\']\)'),
]


def find_express_routes(file_path: str) -> list[dict]:
    routes = []
    try:
        with open(file_path, "r", encoding="utf-8", errors="replace") as f:
            content = f.read()
    except OSError as e:
        logger.warning("Failed to read JS/TS file for routes %s: %s", file_path, e)
        return routes

    for pattern in EXPRESS_ROUTE_PATTERNS:
        for match in pattern.finditer(content):
            if pattern.groups == 2:
                method = match.group(1).upper()
                path = match.group(2)
            else:
                method = "ANY"
                path = match.group(1)
            routes.append({
                "method": method,
                "path": path,
                "function": "",
                "framework": "express",
            })

    return routes
