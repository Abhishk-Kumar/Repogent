import logging
from typing import Optional

from pydantic import BaseModel, Field
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import PydanticOutputParser

from app.llm_router import router as llm_router, RoutePurpose

logger = logging.getLogger(__name__)


class TriageResult(BaseModel):
    issue_id: str = Field(description="Original issue ID from the scan report")
    title: str = Field(description="Issue title")
    file: str = Field(description="File path where the issue was found")
    line: int = Field(description="Line number")
    auto_fixable: bool = Field(description="Whether this issue can be safely auto-fixed")
    category: str = Field(description="Category: formatting | docstring | unused_import | null_check | logic_bug | security | other")
    confidence: float = Field(description="Confidence score 0-1", ge=0, le=1)
    fix_strategy: Optional[str] = Field(default=None, description="Brief description of the fix approach")


FIXABLE_CATEGORIES = {"formatting", "docstring", "unused_import", "null_check"}

TRIAGE_PROMPT = ChatPromptTemplate.from_messages([
    ("system", """You are a code review triage specialist. Given a scan issue from a codebase audit, classify it:

Categories:
- formatting: Indentation, whitespace, style issues (NOT logic)
- docstring: Missing docstrings, type hints, or comments on public APIs
- unused_import: Imported modules that are never used
- null_check: Missing None/null checks that could cause crashes
- logic_bug: Actual logic errors, race conditions, algorithm issues
- security: Hardcoded secrets, eval/exec, injection risks
- other: Everything else

Rules:
- Only formatting, docstring, unused_import, and null_check are auto_fixable
- logic_bug and security are NEVER auto_fixable
- Return structured output ONLY, no extra text"""),
    ("human", "Issue: {issue_title}\nSeverity: {severity}\nFile: {file_path}\nDetail: {detail}\n\nClassify this issue:"),
])

parser = PydanticOutputParser(pydantic_object=TriageResult)


def classify_issue(issue: dict) -> TriageResult:
    llm = llm_router.get_llm(purpose=RoutePurpose.TRIAGE)
    chain = TRIAGE_PROMPT | llm | parser
    try:
        result = llm_router.call_with_retry(
            chain,
            {
                "issue_title": issue.get("title", ""),
                "severity": issue.get("severity", "low"),
                "file_path": issue.get("file", ""),
                "detail": issue.get("detail", ""),
            },
            purpose=RoutePurpose.TRIAGE,
        )
        return result
    except Exception as e:
        logger.warning("Triage failed for issue %s: %s", issue.get("id"), e)
        return TriageResult(
            issue_id=issue.get("id", ""),
            title=issue.get("title", ""),
            file=issue.get("file", ""),
            line=issue.get("line", 0),
            auto_fixable=False,
            category="other",
            confidence=0.0,
            fix_strategy=None,
        )


def triage_issues(scan_issues: list[dict]) -> list[TriageResult]:
    results = []
    for issue in scan_issues:
        result = classify_issue(issue)
        results.append(result)
    return results
