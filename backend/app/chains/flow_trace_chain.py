import json
import re
import os
import logging

from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from app.llm_router import get_llm, call_llm_with_retry

logger = logging.getLogger(__name__)

_RESPONSE_FORMAT = json.dumps(
    {
        "flow_name": "POST /onboard",
        "steps": [
            {
                "file_path": "app/routes/onboard.py",
                "function_or_symbol": "onboard",
                "explanation": "Request hits this route handler which starts the SSE stream.",
                "step_number": 1,
            },
        ],
    },
    indent=2,
)


def find_flow_starting_points(graph: dict) -> list[dict]:
    candidates = []
    routes = graph.get("routes", [])
    for r in routes:
        candidates.append({
            "label": f"{r['method']} {r['path']}",
            "file": r["file"],
            "function": r.get("function", ""),
        })

    for node in graph.get("nodes", []):
        nid = node["id"]
        basename = os.path.basename(nid).lower()
        if basename in ("main.py", "app.py", "index.js", "index.tsx", "server.py", "cli.py"):
            if not any(c["file"] == nid for c in candidates):
                candidates.append({
                    "label": f"Entry: {nid}",
                    "file": nid,
                    "function": "",
                })

    for node in graph.get("nodes", []):
        for func in node.get("functions", []):
            if func.startswith("handle") or func.startswith("on") or func == "main":
                if not any(c["file"] == node["id"] and c["function"] == func for c in candidates):
                    candidates.append({
                        "label": f"{func} in {node['id']}",
                        "file": node["id"],
                        "function": func,
                    })

    return candidates


def _walk_forward(file_path: str, graph: dict, max_hops: int = 6) -> tuple[list[str], list[str]]:
    """
    Walk forward through the dependency graph from a starting file.
    Returns: (primary_path, truncated_branches)
    """
    edges = graph.get("edges", [])
    path = [file_path]
    visited = {file_path}
    current = file_path
    truncated_branches = []

    for _ in range(max_hops - 1):
        next_files = [e["target"] for e in edges if e["source"] == current and e["target"] not in visited]
        if not next_files:
            break
        
        # Take the first file as primary path
        next_file = next_files[0]
        path.append(next_file)
        visited.add(next_file)
        current = next_file
        
        # Record any additional branches that were truncated
        if len(next_files) > 1:
            truncated = next_files[1:]
            truncated_branches.extend(truncated)

    return path, truncated_branches


def _read_file_content(file_path: str, repo_root: str) -> str:
    full_path = file_path if os.path.isabs(file_path) else os.path.join(repo_root, file_path)
    try:
        with open(full_path, "r", encoding="utf-8", errors="replace") as f:
            content = f.read(3000)
        return content
    except OSError:
        return ""


def build_flow_trace_prompt() -> ChatPromptTemplate:
    return ChatPromptTemplate.from_messages([
        (
            "system",
            "You are a code tracer. Given a starting point and an ordered list of files "
            "that form the actual call path through the codebase, narrate each step as a "
            "numbered walkthrough. Explain what happens at each file, citing real functions "
            "and symbols found in the file content provided.\n\n"
            "Respond with a JSON object in this exact format (substitute real values):\n"
            "{response_format}\n\n"
            "Valid JSON only, no markdown, no code fences."
        ),
        (
            "human",
            "Flow starting point: {start_label}\n\n"
            "File walkthrough path:\n{file_paths}\n\n"
            "File contents (in order):\n{file_contents}\n\n"
            "Output ONLY valid JSON matching the schema above."
        ),
    ])


def _build_flow_trace_chain():
    prompt = build_flow_trace_prompt()
    llm = get_llm()
    return prompt | llm | StrOutputParser()


async def generate_flow_trace(starting_file: str, graph: dict, repo_root: str, start_label: str | None = None) -> dict:
    path, truncated_branches = _walk_forward(starting_file, graph)
    if not path:
        return {"flow_name": start_label or starting_file, "steps": []}

    file_contents = []
    for fp in path:
        content = _read_file_content(fp, repo_root)
        header = f"--- {fp} ---\n"
        file_contents.append(header + content)

    # Add branch truncation info to the LLM input
    branch_note = ""
    if truncated_branches:
        branch_note = f"\n\nNote: Branching was truncated at some steps. Additional untraced files: {', '.join(sorted(set(truncated_branches))[:5])}"
        if len(set(truncated_branches)) > 5:
            branch_note += f" and {len(set(truncated_branches)) - 5} more."

    chain = _build_flow_trace_chain()
    inputs = {
        "start_label": start_label or starting_file,
        "file_paths": "\n".join(f"{i+1}. {f}" for i, f in enumerate(path)) + branch_note,
        "file_contents": "\n\n".join(file_contents),
        "response_format": _RESPONSE_FORMAT,
    }

    try:
        raw = await call_llm_with_retry(chain, inputs)
        json_match = re.search(r'\{.*\}', raw, re.DOTALL)
        if json_match:
            data = json.loads(json_match.group())
            # Add branch truncation flag to the result
            result = {
                "flow_name": data.get("flow_name", start_label or starting_file),
                "steps": data.get("steps", []),
            }
            if truncated_branches:
                result["branch_truncation_note"] = f"Flow trace shows one linear path, but {len(set(truncated_branches))} alternative branches were truncated."
                result["truncated_branches"] = list(sorted(set(truncated_branches)))
            return result
    except Exception as e:
        logger.warning("Flow trace LLM call failed: %s", e)

    result = {
        "flow_name": start_label or starting_file,
        "steps": [
            {"file_path": fp, "function_or_symbol": "", "explanation": "", "step_number": i + 1}
            for i, fp in enumerate(path)
        ],
    }
    if truncated_branches:
        result["branch_truncation_note"] = f"Flow trace shows one linear path, but {len(set(truncated_branches))} alternative branches were truncated."
        result["truncated_branches"] = list(sorted(set(truncated_branches)))
    return result
