from pydantic_settings import BaseSettings
from typing import List


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

    cors_origins: List[str] = ["*"]
    frontend_url: str = ""

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
