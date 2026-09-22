import ast
import logging
import re
from typing import Optional

logger = logging.getLogger(__name__)


def verify_fix(original_content: str, patched_content: str, file_path: str) -> tuple[bool, str]:
    ext = file_path.rsplit(".", 1)[-1].lower() if "." in file_path else ""

    if ext == "py":
        return _verify_python(patched_content, file_path)
    elif ext in ("js", "jsx", "ts", "tsx"):
        return _verify_typescript(patched_content, file_path)
    else:
        return True, "unverified — manual review recommended"


def _verify_python(content: str, file_path: str) -> tuple[bool, str]:
    try:
        ast.parse(content)
        return True, "syntax OK"
    except SyntaxError as e:
        logger.warning("Python syntax error in %s: %s", file_path, e)
        return False, f"failed — needs manual review: {e}"


def _verify_typescript(content: str, file_path: str) -> tuple[bool, str]:
    try:
        import subprocess, tempfile, os
        with tempfile.NamedTemporaryFile(mode="w", suffix=".ts", delete=False) as f:
            f.write(content)
            tmp_path = f.name
        result = subprocess.run(
            ["npx", "tsc", "--noEmit", "--lib", "es2020,dom", tmp_path],
            capture_output=True, text=True, timeout=15,
        )
        os.unlink(tmp_path)
        if result.returncode == 0:
            return True, "syntax OK"
        logger.warning("TS syntax error in %s: %s", file_path, result.stderr[:200])
        return False, f"failed — needs manual review"
    except FileNotFoundError:
        return True, "unverified — tsc not available, manual review recommended"
    except Exception as e:
        logger.warning("TS verification error: %s", e)
        return True, "unverified — verification error, manual review recommended"


def apply_patch(original_content: str, fix: "FixResult") -> Optional[str]:
    if fix.original_snippet in original_content:
        return original_content.replace(fix.original_snippet, fix.patched_snippet, 1)

    import difflib
    matches = difflib.get_close_matches(fix.original_snippet, original_content.split("\n"), n=1, cutoff=0.8)
    if matches:
        return original_content.replace(matches[0], fix.patched_snippet, 1)

    logger.warning("Could not apply patch for %s: original snippet not found", fix.file_path)
    return None
