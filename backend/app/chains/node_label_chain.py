import json
import re
import os
import logging

from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from app.llm_router import get_llm, call_llm_with_retry

logger = logging.getLogger(__name__)

_RESPONSE_FORMAT = json.dumps(
    [{"file_path": "path/to/file.py", "purpose": "Handles user authentication"}],
    indent=2,
)

_FOLDER_HINTS: dict[str, str] = {
    "routes": "API route handlers",
    "api": "API endpoint definitions",
    "models": "Data models and schemas",
    "schemas": "Data schemas and validation",
    "controllers": "Request handling and business logic",
    "services": "Business logic and orchestration",
    "middleware": "Request processing middleware",
    "utils": "Utility and helper functions",
    "helpers": "Helper utilities",
    "config": "Configuration settings",
    "db": "Database operations",
    "migrations": "Database schema migrations",
    "tests": "Test suite",
    "spec": "Test specifications",
    "__tests__": "Test suite",
    "components": "UI components",
    "pages": "Page components",
    "layouts": "Layout components",
    "hooks": "React hooks",
    "store": "State management",
    "reducers": "State reducers",
    "actions": "Redux actions",
    "types": "TypeScript type definitions",
    "interfaces": "TypeScript interfaces",
    "styles": "Styles and theming",
    "assets": "Static assets",
    "public": "Static files",
    "scripts": "Build and utility scripts",
    "docker": "Docker configuration",
    "ci": "CI/CD configuration",
    "github": "GitHub workflows and templates",
    "lib": "Library code",
    "core": "Core application logic",
}


def _heuristic_label(file_path: str, functions: list[str], classes: list[str]) -> str:
    parts = file_path.replace("\\", "/").split("/")
    filename = parts[-1] if parts else file_path
    name, ext = os.path.splitext(filename) if "." in filename else (filename, "")
    ext = os.path.splitext(filename)[1] if "." in filename else ""
    folder = parts[-2] if len(parts) > 1 else ""

    if functions:
        return f"Defines {functions[0]}{' and ' + functions[1] if len(functions) > 1 else ''}"
    if classes:
        return f"Defines {classes[0]} class"

    folder_hint = _FOLDER_HINTS.get(folder) or _FOLDER_HINTS.get(folder.rstrip("s"))
    if folder_hint:
        return folder_hint

    if name in ("index", "main", "app", "server"):
        return "Application entry point"
    if name in ("setup", "Makefile", "package"):
        return "Project setup and configuration"
    if name in ("cli", "console"):
        return "Command-line interface"

    readable = name.replace("_", " ").replace("-", " ").title()
    if ext in (".py", ".js", ".ts", ".tsx", ".jsx", ".go", ".rs", ".java"):
        return f"{readable} module"
    return readable


def build_label_prompt() -> ChatPromptTemplate:
    return ChatPromptTemplate.from_messages([
        (
            "system",
            "You are a codebase analyst. Given a list of file paths with their detected functions and classes, "
            "assign a short one-line purpose to each file (max 80 chars). Be concrete and specific — "
            "describe what the file actually does, not generic labels like 'utility module'.\n\n"
            "Respond with a JSON array in this exact format (substitute real values):\n"
            "{response_format}\n\n"
            "Valid JSON only, no markdown, no code fences."
        ),
        (
            "human",
            "Assign purposes to these files:\n{files_json}\n\n"
            "Output ONLY valid JSON array matching the schema."
        ),
    ])


def _build_label_chain():
    prompt = build_label_prompt()
    llm = get_llm()
    return prompt | llm | StrOutputParser()


async def generate_node_labels(nodes: list[dict]) -> list[dict]:
    if not nodes:
        return []

    try:
        llm = get_llm()
    except Exception:
        llm = None

    if llm is None:
        logger.info("No LLM available — using heuristic labels")
        for node in nodes:
            node["purpose"] = _heuristic_label(
                node["id"], node.get("functions", []), node.get("classes", []),
            )
        return nodes

    file_data = []
    for n in nodes:
        entry = {"file_path": n["id"], "functions": n.get("functions", []), "classes": n.get("classes", [])}
        file_data.append(entry)

    chain = _build_label_chain()
    inputs = {
        "files_json": json.dumps(file_data, indent=2),
        "response_format": _RESPONSE_FORMAT,
    }

    try:
        raw = await call_llm_with_retry(chain, inputs, hard_timeout=15)
        json_match = re.search(r'\[.*?\]', raw, re.DOTALL)
        if json_match:
            labels = json.loads(json_match.group())
            label_map = {item["file_path"]: item["purpose"] for item in labels if "file_path" in item and "purpose" in item}
            for node in nodes:
                if node["id"] in label_map:
                    node["purpose"] = label_map[node["id"]]
                else:
                    node["purpose"] = _heuristic_label(
                        node["id"], node.get("functions", []), node.get("classes", []),
                    )
            return nodes
    except Exception as e:
        logger.warning("LLM labeling failed (%s) — using heuristic labels", e)

    for node in nodes:
        node["purpose"] = _heuristic_label(
            node["id"], node.get("functions", []), node.get("classes", []),
        )
    return nodes
