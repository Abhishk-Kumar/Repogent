"""11.1 — import-resolver unit tests (05).

Fixtures: relative imports, extensionless, CJS require, tsconfig path
aliases, dynamic import diagnostics. Run: pytest backend/tests
"""
import os

from app.graph.js_parser import parse_js_imports
from app.graph.python_parser import parse_python_imports


def _write(root: str, rel: str, content: str) -> str:
    path = os.path.join(root, rel)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w") as f:
        f.write(content)
    return path


def _resolved_paths(imports: list[dict]) -> list[str]:
    return sorted(i["resolved_path"] for i in imports if i.get("resolved_path"))


def test_python_relative_import_resolves(tmp_path):
    root = str(tmp_path)
    _write(root, "pkg/__init__.py", "")
    _write(root, "pkg/b.py", "X = 1\n")
    a = _write(root, "pkg/a.py", "from .b import X\n")
    imports = parse_python_imports(a, root)
    assert os.path.join("pkg", "b.py") in _resolved_paths(imports)


def test_python_stdlib_not_counted_unresolved(tmp_path):
    root = str(tmp_path)
    a = _write(root, "a.py", "import os\nimport sys\n")
    stats: dict = {}
    imports = parse_python_imports(a, root, stats)
    assert imports == []
    assert stats.get("unresolved", 0) == 0


def test_python_syntax_error_marks_unparsed(tmp_path):
    root = str(tmp_path)
    bad = _write(root, "bad.py", "def broken(:\n")
    stats: dict = {}
    assert parse_python_imports(bad, root, stats) == []
    assert stats.get("unparsed") is True


def test_js_relative_extensionless_resolves(tmp_path):
    root = str(tmp_path)
    _write(root, "src/util.js", "export const x = 1;\n")
    idx = _write(root, "src/index.js", 'import { x } from "./util";\n')
    assert os.path.join("src", "util.js") in _resolved_paths(parse_js_imports(idx, root))


def test_js_cjs_require_resolves(tmp_path):
    root = str(tmp_path)
    _write(root, "lib/util.js", "module.exports = {};\n")
    main = _write(root, "lib/main.js", 'const { x } = require("./util");\n')
    assert os.path.join("lib", "util.js") in _resolved_paths(parse_js_imports(main, root))


def test_js_tsconfig_paths_alias_resolves(tmp_path):
    root = str(tmp_path)
    _write(root, "tsconfig.json", '{"compilerOptions": {"baseUrl": ".", "paths": {"@/*": ["src/*"]}}}')
    _write(root, "src/foo.ts", "export const foo = 1;\n")
    app = _write(root, "src/app.ts", 'import { foo } from "@/foo";\n')
    assert os.path.join("src", "foo.ts") in _resolved_paths(parse_js_imports(app, root))


def test_js_unresolvable_relative_counts_diagnostic(tmp_path):
    root = str(tmp_path)
    app = _write(root, "app.js", 'import x from "./does-not-exist";\n')
    stats: dict = {}
    assert parse_js_imports(app, root, stats) == []
    assert stats.get("unresolved", 0) >= 1


def test_js_bare_npm_import_not_counted(tmp_path):
    root = str(tmp_path)
    app = _write(root, "app.js", 'import React from "react";\n')
    stats: dict = {}
    parse_js_imports(app, root, stats)
    assert stats.get("unresolved", 0) == 0
