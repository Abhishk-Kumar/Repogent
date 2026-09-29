import asyncio
import time
import logging
import threading
from enum import Enum
from typing import Optional

from app.config import settings

logger = logging.getLogger(__name__)


class RoutePurpose(Enum):
    CHAT = "chat"
    EXPLAIN = "explain"
    SCAN = "scan"
    TRIAGE = "triage"
    FIX = "fix"


class LLMRouter:
    def __init__(self):
        self._instances: dict[str, object] = {}
        self._lock = threading.Lock()
        self._current_provider: str = "groq"

    def _build_groq(self) -> object | None:
        if not settings.groq_api_key:
            logger.warning("GROQ_API_KEY not set — Groq unavailable")
            return None
        from langchain_groq import ChatGroq
        return ChatGroq(
            model=settings.chat_model_id,
            temperature=0,
            max_retries=0,
            timeout=30,
        )

    def _build_mistral(self) -> object | None:
        if not settings.mistral_api_key:
            logger.warning("MISTRAL_API_KEY not set — Mistral unavailable")
            return None
        from langchain_mistralai import ChatMistralAI
        return ChatMistralAI(
            model="mistral-small-latest",
            temperature=0,
            max_retries=0,
            timeout=30,
        )

    def _preferred_provider(self, purpose: Optional[RoutePurpose]) -> str:
        if purpose == RoutePurpose.CHAT:
            return "groq"
        if purpose == RoutePurpose.EXPLAIN:
            return "mistral"
        return self._current_provider

    def _ensure_provider(self, provider: str) -> bool:
        if provider in self._instances:
            return True
        with self._lock:
            if provider in self._instances:
                return True
            builder = self._build_groq if provider == "groq" else self._build_mistral
            try:
                instance = builder()
                if instance is not None:
                    self._instances[provider] = instance
                    # Log model name when initializing
                    model_name = self._get_model_name(instance, provider)
                    logger.info("LLM provider initialized: %s (model: %s)", provider, model_name)
                    return True
            except Exception as e:
                logger.warning("Failed to init %s: %s", provider, e)
            return False

    def _get_model_name(self, instance, provider: str) -> str:
        """Extract model name from LLM instance for logging."""
        try:
            if provider == "groq":
                return getattr(instance, "model", "openai/gpt-oss-120b")
            elif provider == "mistral":
                return getattr(instance, "model", "mistral-small-latest")
        except Exception:
            pass
        return "unknown"

    def get_llm(self, purpose: Optional[RoutePurpose] = None) -> object:
        preferred = self._preferred_provider(purpose)
        if self._ensure_provider(preferred):
            self._current_provider = preferred
            instance = self._instances[preferred]
            # Log provider choice and model name
            model_name = self._get_model_name(instance, preferred)
            logger.info("Selected LLM provider: %s (purpose: %s)", preferred, purpose.value if purpose else "default")
            logger.debug("LLM model: %s", model_name)
            return instance

        fallback = "mistral" if preferred == "groq" else "groq"
        if self._ensure_provider(fallback):
            self._current_provider = fallback
            instance = self._instances[fallback]
            model_name = self._get_model_name(instance, fallback)
            logger.info("Fell back to LLM provider: %s (purpose: %s)", fallback, purpose.value if purpose else "default")
            logger.debug("Fallback LLM model: %s", model_name)
            return instance

        raise RuntimeError("No LLM provider available — set GROQ_API_KEY or MISTRAL_API_KEY")

    def get_provider_name(self) -> str:
        return self._current_provider

    def switch_provider(self, new_provider: str):
        if self._ensure_provider(new_provider):
            self._current_provider = new_provider
            logger.info("Switched LLM provider to %s", new_provider)
        else:
            logger.warning("Unknown or unavailable provider %s, ignoring", new_provider)

    def call_with_retry(self, chain, inputs: dict, hard_timeout: int = 30,
                        purpose: Optional[RoutePurpose] = None) -> str:
        last_error = None
        delay = settings.mistral_retry_initial_delay
        provider = self.get_provider_name()

        for attempt in range(settings.mistral_retry_max_attempts):
            try:
                logger.info("[%s] LLM call attempt %d/%d ...", provider, attempt + 1,
                            settings.mistral_retry_max_attempts)
                t0 = time.time()

                import concurrent.futures
                executor = concurrent.futures.ThreadPoolExecutor(max_workers=1)
                future = executor.submit(chain.invoke, inputs)
                result = future.result(timeout=hard_timeout)
                executor.shutdown(wait=False)

                elapsed = round(time.time() - t0, 2)
                logger.info("[%s] LLM call succeeded in %.2fs", provider, elapsed)
                return result

            except concurrent.futures.TimeoutError:
                elapsed = round(time.time() - t0, 2)
                logger.warning("[%s] TIMEOUT %.2fs (attempt %d/%d)", provider, elapsed,
                               attempt + 1, settings.mistral_retry_max_attempts)
                last_error = TimeoutError(f"LLM call timed out after {hard_timeout}s")
                if attempt < settings.mistral_retry_max_attempts - 1:
                    time.sleep(delay)
                    delay = min(delay * 2, settings.mistral_retry_max_delay)
                    continue
                raise last_error

            except Exception as e:
                last_error = e
                error_str = str(e).lower()
                is_rate_limit = "429" in error_str or "rate limit" in error_str
                is_server_error = "500" in error_str or "502" in error_str or "503" in error_str
                is_auth_error = "auth" in error_str or "401" in error_str or "unauthorized" in error_str

                fallback_provider = "mistral" if provider == "groq" else "groq"

                if is_auth_error and provider == "groq":
                    logger.warning("[groq] Auth error: %s. Falling back to Mistral.", e)
                    self.switch_provider("mistral")
                    provider = "mistral"
                    attempt -= 1
                    continue

                if is_rate_limit and fallback_provider:
                    logger.warning("[%s] Rate limited. Trying %s as fallback.", provider, fallback_provider)
                    self.switch_provider(fallback_provider)
                    provider = fallback_provider
                    continue

                if is_rate_limit or is_server_error:
                    if attempt < settings.mistral_retry_max_attempts - 1:
                        logger.warning("[%s] Attempt %d/%d failed: %s. Retry in %.1fs",
                                       provider, attempt + 1, settings.mistral_retry_max_attempts,
                                       e, delay)
                        time.sleep(delay)
                        delay = min(delay * 2, settings.mistral_retry_max_delay)
                        continue

                logger.error("[%s] Non-retryable error: %s", provider, e)
                if purpose == RoutePurpose.CHAT:
                    raise RuntimeError("chat_unavailable")
                raise

        raise last_error


router = LLMRouter()


# ── Async-compatible convenience wrappers (replaces app/llm.py) ──

async def call_llm_with_retry(chain, inputs: dict, hard_timeout: int = 30, purpose: Optional[RoutePurpose] = None) -> str:
    last_error = None
    delay = settings.mistral_retry_initial_delay
    provider = router.get_provider_name()
    loop = asyncio.get_event_loop()

    for attempt in range(settings.mistral_retry_max_attempts):
        try:
            logger.info("[%s] LLM call attempt %d/%d...", provider, attempt + 1, settings.mistral_retry_max_attempts)
            t0 = time.time()

            result = await asyncio.wait_for(
                loop.run_in_executor(None, chain.invoke, inputs),
                timeout=hard_timeout,
            )

            elapsed = round(time.time() - t0, 2)
            logger.info("[%s] LLM call succeeded in %.2fs", provider, elapsed)
            return result

        except asyncio.TimeoutError:
            elapsed = round(time.time() - t0, 2) if 't0' in dir() else -1
            logger.warning(
                "[%s] LLM call TIMED OUT after %.2fs (attempt %d/%d, hard timeout=%ds).",
                provider, elapsed, attempt + 1, settings.mistral_retry_max_attempts, hard_timeout,
            )
            last_error = TimeoutError(f"LLM call timed out after {hard_timeout}s")

            if attempt < settings.mistral_retry_max_attempts - 1:
                logger.warning("[%s] Retrying in %.1fs...", provider, delay)
                await asyncio.sleep(delay)
                delay = min(delay * 2, settings.mistral_retry_max_delay)
                continue

            raise last_error

        except Exception as e:
            last_error = e
            elapsed = round(time.time() - t0, 2) if 't0' in dir() else -1
            error_str = str(e).lower()
            is_rate_limit = "429" in error_str or "rate limit" in error_str
            is_server_error = "500" in error_str or "502" in error_str or "503" in error_str

            if provider == "groq" and (is_rate_limit or "auth" in error_str or "unauthorized" in error_str or "401" in error_str):
                logger.warning("[groq] Provider error: %s. Falling back to Mistral.", e)
                _switch_to_mistral()
                provider = "mistral"
                attempt -= 1
                continue

            if is_rate_limit or is_server_error:
                if attempt < settings.mistral_retry_max_attempts - 1:
                    logger.warning(
                        "[%s] LLM call failed (attempt %d/%d) in %.2fs: %s. Retrying in %.1fs...",
                        provider, attempt + 1, settings.mistral_retry_max_attempts,
                        elapsed, e, delay,
                    )
                    await asyncio.sleep(delay)
                    delay = min(delay * 2, settings.mistral_retry_max_delay)
                    continue

            logger.error("[%s] LLM call failed (non-retryable) in %.2fs: %s", provider, elapsed, e)
            if purpose == RoutePurpose.CHAT:
                raise RuntimeError("chat_unavailable")
            raise

    raise last_error


def get_llm():
    return router.get_llm()


def get_llm_provider() -> str:
    return router.get_provider_name()





def _switch_to_mistral():
    router.switch_provider("mistral")
