import logging
from typing import Optional

from pydantic import BaseModel, Field
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import PydanticOutputParser

from app.llm_router import router as llm_router, RoutePurpose

logger = logging.getLogger(__name__)


class FixResult(BaseModel):
    issue_id: str = Field(description="Original issue ID")
    file_path: str = Field(description="File to modify")
    original_snippet: str = Field(description="The original code snippet to replace")
    patched_snippet: str = Field(description="The replacement code")
    description: str = Field(description="Brief description of the fix")


FIX_PROMPT = ChatPromptTemplate.from_messages([
    ("system", """You are an expert code fixer. Given a code issue and the file content, generate a minimal fix.

Rules:
- Return ONLY the changed snippet with enough surrounding context for a clean replacement
- Never change logic — only apply the specific fix requested
- Preserve all existing code, imports, and functionality
- Use correct indentation matching the file's style"""),
    ("human", """Issue: {issue_title}
Category: {category}
Detail: {detail}

File: {file_path}
Relevant code context:
```{language}
{file_content}
```

Generate the fix as a snippet replacement:"""),
])

parser = PydanticOutputParser(pydantic_object=FixResult)


def generate_fix(issue: dict, file_content: str, language: str = "python") -> Optional[FixResult]:
    llm = llm_router.get_llm(purpose=RoutePurpose.FIX)
    chain = FIX_PROMPT | llm | parser
    try:
        result = llm_router.call_with_retry(
            chain,
            {
                "issue_title": issue.get("title", ""),
                "category": issue.get("category", "other"),
                "detail": issue.get("detail", ""),
                "file_path": issue.get("file", ""),
                "language": language,
                "file_content": file_content[:3000],
            },
            purpose=RoutePurpose.FIX,
        )
        return result
    except Exception as e:
        logger.warning("Fix generation failed for issue %s: %s", issue.get("id"), e)
        return None
