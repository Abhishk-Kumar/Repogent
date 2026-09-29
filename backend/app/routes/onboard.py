import hashlib
import logging

from fastapi import APIRouter

from app.cache import get_cached, set_cache
from app.models.schemas import OnboardRequest, AskRequest, TraceFlowRequest, StartHereRequest, ExplainFileRequest
from app.utils.normalize import get_cache_key
from app.chains.flow_trace_chain import generate_flow_trace
from app.graph.blast_radius import compute_blast_radius
from app.routes.jobs import submit_job
from app.utils.normalize import normalize_repo_url

logger = logging.getLogger(__name__)

router = APIRouter()

_session_store: dict[str, dict] = {}


@router.post("/onboard/async")
async def onboard_async(request: OnboardRequest):
    job_result = await submit_job({"repo_url": request.repo_url, "job_type": "onboard"})
    return job_result


@router.post("/trace_flow")
async def trace_flow(request: TraceFlowRequest):
    session = _session_store.get(normalize_repo_url(request.session_id))
    if not session:
        return {"error": "Session not found. Please re-onboard the repo."}

    try:
        graph = session["graph"]
        repo_root = session["repo_path"]
        flow_result = await generate_flow_trace(request.starting_file, graph, repo_root)
        return flow_result
    except Exception as e:
        logger.exception("Flow trace failed")
        return {"error": str(e)}


@router.post("/start_here")
async def start_here(request: StartHereRequest):
    session = _session_store.get(normalize_repo_url(request.session_id))
    if not session:
        return {"error": "Session not found. Please re-onboard the repo."}

    try:
        from app.chains.start_here_chain import generate_start_here
        result = await generate_start_here(session["graph"], request.goal)
        return result
    except Exception as e:
        logger.exception("Start here failed")
        return {"error": str(e)}


@router.post("/blast_radius")
async def blast_radius(request: ExplainFileRequest):
    session = _session_store.get(normalize_repo_url(request.session_id))
    if not session:
        return {"error": "Session not found. Please re-onboard the repo."}

    try:
        result = compute_blast_radius(request.file_path, session["graph"])
        return result
    except Exception as e:
        logger.exception("Blast radius failed")
        return {"error": str(e)}


@router.post("/explain_file")
async def explain_file(request: ExplainFileRequest):
    session = _session_store.get(normalize_repo_url(request.session_id))
    if not session:
        return {"error": "Session not found. Please re-onboard the repo."}

    try:
        from app.tools.code_tools import read_file
        from app.llm_router import get_llm, call_llm_with_retry, RoutePurpose
        from langchain_core.prompts import ChatPromptTemplate
        from langchain_core.output_parsers import StrOutputParser

        import os
        original_repo_path = None
        try:
            from app.tools.code_tools import _REPO_PATH
            original_repo_path = _REPO_PATH
        except Exception:
            pass

        from app.tools.code_tools import set_repo_context
        set_repo_context(session["repo_path"], None)

        content = read_file.invoke({"file_path": request.file_path})
        if content.startswith("Error"):
            return {"error": content}

        prompt = ChatPromptTemplate.from_messages([
            ("system", "You are a code analyst. Given a file's content, write a brief 2-3 sentence explanation of what this file does, its key exports/functions, and how it fits in a codebase. Be specific and cite function names."),
            ("human", "File: {file_path}\n\nContent:\n{content}"),
        ])
        chain = prompt | get_llm() | StrOutputParser()
        explanation = await call_llm_with_retry(chain, {"file_path": request.file_path, "content": content})

        return {"file_path": request.file_path, "explanation": explanation}
    except Exception as e:
        logger.exception("Explain file failed")
        return {"error": str(e)}


@router.post("/ask")
async def ask(request: AskRequest):
    session = _session_store.get(normalize_repo_url(request.session_id))
    if not session:
        return {"answer": "Session not found. Please re-onboard the repo first."}

    # Answer cache: identical questions against the same repo+commit skip
    # retrieval + LLM entirely. Keyed per commit so new code invalidates.
    qhash = hashlib.sha256(request.question.strip().lower().encode()).hexdigest()[:16]
    cache_key = get_cache_key(request.session_id, f"{session.get('commit_sha', '')}::ask::{qhash}")
    try:
        hit = await get_cached(cache_key)
    except Exception:
        logger.warning("Ask cache lookup failed; proceeding uncached", exc_info=True)
        hit = None
    if hit and isinstance(hit.get("answer"), str):
        return {"answer": hit["answer"], "cached": True}

    try:
        from app.ingestion.vector_store import get_vector_store
        from app.llm_router import get_llm, call_llm_with_retry, RoutePurpose
        from langchain_core.prompts import ChatPromptTemplate
        from langchain_core.output_parsers import StrOutputParser

        vectorstore = get_vector_store(request.session_id)
        if vectorstore:
            results = vectorstore.similarity_search(request.question, k=5)
            context = "\n\n".join(
                f"Source: {r.metadata.get('source', 'unknown')}\n{r.page_content}"
                for r in results
            )
        else:
            context = "⚠️ No vector index available. This usually means the vector store directory was lost or corrupted. Please re-onboard the repository to rebuild the search index."

        prompt = ChatPromptTemplate.from_messages([
            ("system", "You are a codebase assistant. Answer the user's question about the codebase based on the provided context. Cite specific file paths where relevant. If the context doesn't contain enough information, say so."),
            ("human", "Context from the codebase:\n{context}\n\nQuestion: {question}\n\nAnswer:"),
        ])
        chain = prompt | get_llm() | StrOutputParser()
        answer = await call_llm_with_retry(chain, {"context": context, "question": request.question}, purpose=RoutePurpose.CHAT)

        try:
            await set_cache(cache_key, {"answer": answer})
        except Exception:
            logger.warning("Ask cache store failed; returning uncached answer", exc_info=True)
        return {"answer": answer}
    except RuntimeError as e:
        # Error boundary: never leak raw provider payload to the client.
        logger.exception("Ask failed (provider error)")
        return {"error": "chat_unavailable", "retryable": True}
    except Exception:
        logger.exception("Ask failed")
        return {"error": "chat_unavailable", "retryable": True}
