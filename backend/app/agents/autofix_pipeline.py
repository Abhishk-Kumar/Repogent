import json
import logging
import os
from typing import Any, Optional

from app.agents.triage_agent import triage_issues, FIXABLE_CATEGORIES, TriageResult
from app.agents.fix_agent import generate_fix, FixResult
from app.agents.verifier import verify_fix, apply_patch
from app.agents.pr_agent import open_fix_pr
from app.routes.jobs import update_job

logger = logging.getLogger(__name__)


async def run_autofix_pipeline(
    job_id: str,
    repo_identifier: str,
    repo_path: str,
    scan_issues: list[dict],
) -> dict:
    await update_job(job_id, progress_message="Triaging issues...", progress_current=1, progress_total=5)

    triage_results = triage_issues(scan_issues)
    fixable_issues = [t for t in triage_results if t.auto_fixable and t.category in FIXABLE_CATEGORIES]
    total_fixable = len(fixable_issues)

    if total_fixable == 0:
        await update_job(job_id, status="done", progress_message="No auto-fixable issues found",
                         progress_current=5, progress_total=5,
                         result_json=json.dumps({"fixed": 0, "message": "No auto-fixable issues found"}))
        return {"fixed": 0, "message": "No auto-fixable issues found"}

    await update_job(job_id, progress_message=f"Generating fixes (0/{total_fixable})...",
                     progress_current=2, progress_total=5)

    fixes: list[dict] = []
    for i, triage_result in enumerate(fixable_issues):
        await update_job(job_id, progress_message=f"Generating fixes ({i}/{total_fixable})...",
                         progress_current=2, progress_total=5)

        issue_dict = {
            "id": triage_result.issue_id,
            "title": triage_result.title,
            "file": triage_result.file,
            "line": triage_result.line,
            "category": triage_result.category,
            "detail": "",
        }

        file_content = ""
        full_path = os.path.join(repo_path, triage_result.file)
        try:
            with open(full_path, "r", errors="ignore") as f:
                file_content = f.read()
        except Exception:
            logger.warning("Could not read %s", triage_result.file)
            continue

        ext = os.path.splitext(triage_result.file)[1].lower()
        lang_map = {".py": "python", ".js": "javascript", ".ts": "typescript", ".tsx": "typescriptreact", ".jsx": "javascriptreact"}
        language = lang_map.get(ext, "python")

        fix_result = generate_fix(issue_dict, file_content, language)
        if not fix_result:
            continue

        patched = apply_patch(file_content, fix_result)
        if not patched:
            continue

        is_valid, verification_msg = verify_fix(file_content, patched, triage_result.file)
        if not is_valid:
            logger.warning("Fix verification failed for %s: %s", triage_result.file, verification_msg)
            continue

        fixes.append({
            "issue_id": triage_result.issue_id,
            "file_path": triage_result.file,
            "patched_content": patched,
            "description": fix_result.description,
        })

    if not fixes:
        await update_job(job_id, status="done", progress_message="No valid fixes generated",
                         progress_current=5, progress_total=5,
                         result_json=json.dumps({"fixed": 0, "message": "Generated fixes failed verification"}))
        return {"fixed": 0, "message": "Generated fixes failed verification"}

    await update_job(job_id, progress_message="Opening PR...", progress_current=4, progress_total=5)

    pr_result = await open_fix_pr(repo_identifier, fixes, repo_path)

    if pr_result:
        result = {"fixed": len(fixes), "pr_url": pr_result["url"], "pr_number": pr_result["number"]}
        await update_job(job_id, status="done", progress_message=f"PR #{pr_result['number']} opened",
                         progress_current=5, progress_total=5,
                         result_json=json.dumps(result))
        return result

    await update_job(job_id, status="done", progress_message="Fixes generated but PR creation failed",
                     progress_current=5, progress_total=5,
                     result_json=json.dumps({"fixed": len(fixes), "message": "PR creation failed — check GitHub connection"}))
    return {"fixed": len(fixes), "message": "PR creation failed"}
