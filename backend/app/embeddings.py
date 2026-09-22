import threading
import logging
import hashlib

logger = logging.getLogger(__name__)

_embeddings_instance = None
_embeddings_lock = threading.Lock()

EMBEDDER_IDENTIFIER = "hash-v1"  # Track which embedder created the vector store


class _SimpleEmbeddings:
    """Zero-dependency fallback when API is unavailable. Quality is basic."""

    DIM = 128

    def embed_documents(self, texts):
        result = []
        for text in texts:
            h = hashlib.sha256(text.encode()).digest()
            result.append([b / 255.0 for b in h[:self.DIM]])
        return result

    def embed_query(self, text):
        return self.embed_documents([text])[0]


def get_embeddings():
    global _embeddings_instance
    if _embeddings_instance is None:
        with _embeddings_lock:
            if _embeddings_instance is None:
                logger.info("Using simple embeddings (no external API calls).")
                _embeddings_instance = _SimpleEmbeddings()
    return _embeddings_instance



