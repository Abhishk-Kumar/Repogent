import os
import logging
from app.utils.normalize import get_repo_hash
from app.embeddings import EMBEDDER_IDENTIFIER

logger = logging.getLogger(__name__)


def _repo_cache_key(repo_url: str) -> str:
    return get_repo_hash(repo_url)


def _cache_path(repo_url: str) -> str:
    from app.config import settings
    key = _repo_cache_key(repo_url)
    return os.path.join(settings.vector_store_path, key)


def _get_collection_metadata(persist_directory: str) -> dict:
    """Read collection metadata from ChromaDB persistence directory."""
    metadata_path = os.path.join(persist_directory, "chroma.sqlite3")
    if not os.path.exists(metadata_path):
        return {}
    
    try:
        import sqlite3
        conn = sqlite3.connect(metadata_path)
        cursor = conn.cursor()
        cursor.execute("SELECT name, value FROM collection_metadata")
        metadata = {row[0]: row[1] for row in cursor.fetchall()}
        conn.close()
        return metadata
    except Exception as e:
        logger.warning("Failed to read ChromaDB metadata: %s", e)
        return {}


def build_vector_store(documents, repo_url: str):
    from langchain_chroma import Chroma
    from langchain_core.documents import Document
    from app.embeddings import get_embeddings

    embeddings = get_embeddings()

    cache_dir = _cache_path(repo_url)

    # Check existing vector store and verify embedder compatibility
    if os.path.exists(cache_dir) and os.listdir(cache_dir):
        metadata = _get_collection_metadata(cache_dir)
        stored_embedder = metadata.get("embedder", "")
        if stored_embedder == EMBEDDER_IDENTIFIER:
            logger.info("Reusing cached vector store for %s at %s (embedder: %s)", 
                       repo_url, cache_dir, stored_embedder)
            return Chroma(
                persist_directory=cache_dir,
                embedding_function=embeddings,
            )
        else:
            logger.warning("Vector store embedder mismatch (%s != %s) - rebuilding", 
                          stored_embedder, EMBEDDER_IDENTIFIER)
            # Clean up old incompatible vector store
            import shutil
            shutil.rmtree(cache_dir, ignore_errors=True)

    logger.info("Building new vector store for %s at %s (embedder: %s)", 
               repo_url, cache_dir, EMBEDDER_IDENTIFIER)
    os.makedirs(cache_dir, exist_ok=True)

    vectorstore = Chroma.from_documents(
        documents,
        embeddings,
        persist_directory=cache_dir,
        collection_metadata={"embedder": EMBEDDER_IDENTIFIER, "repo_url": repo_url},
    )
    return vectorstore


def get_vector_store(repo_url: str):
    from langchain_chroma import Chroma
    from app.embeddings import get_embeddings

    cache_dir = _cache_path(repo_url)
    if not os.path.exists(cache_dir) or not os.listdir(cache_dir):
        return None
    
    # Verify embedder compatibility
    metadata = _get_collection_metadata(cache_dir)
    stored_embedder = metadata.get("embedder", "")
    if stored_embedder != EMBEDDER_IDENTIFIER:
        logger.warning("Vector store embedder mismatch: expected %s, found %s", 
                      EMBEDDER_IDENTIFIER, stored_embedder)
        # Continue but log warning - in production you might want to rebuild or raise
        logger.warning("Using mismatched embedder vector store for %s", repo_url)

    return Chroma(
        persist_directory=cache_dir,
        embedding_function=get_embeddings(),
    )
