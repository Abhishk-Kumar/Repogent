from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    mistral_api_key: str = ""
    groq_api_key: str = ""
    embedding_model: str = "sentence-transformers/all-MiniLM-L6-v2"
    vector_store_path: str = "data/chroma_db"
    clone_temp_dir: str = "data/repos"
    db_path: str = "data/codeatlas.db"

    mistral_retry_max_attempts: int = 2
    mistral_retry_initial_delay: float = 0.5
    mistral_retry_max_delay: float = 4.0

    github_app_id: str = ""
    github_app_private_key: str = ""
    github_webhook_secret: str = ""

    job_hard_timeout_seconds: int = 300
    # Deploy guard (see app/security.py). Unset => fail-open local dev.
    deploy_secret: str = ""
    # Canonical public URL. Drives CORS-adjacent origin checks and SEO
    # (sitemap/OG/canonicals) — defaults to the Render deployment.
    site_url: str = "https://repogent.onrender.com"
    ask_rate_limit_per_min: int = 20
    # Groq production flagship (llama-3.3-70b-versatile retired 2026-08-16).
    # Override with CHAT_MODEL_ID env var.
    chat_model_id: str = "openai/gpt-oss-120b"

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
