import datetime
from typing import Optional
from sqlmodel import SQLModel, Field, Column, JSON, Text


def _utc_now() -> datetime.datetime:
    return datetime.datetime.now(datetime.timezone.utc)


from app.utils.normalize import get_repo_hash


def _normalize_repo_identifier(repo_url_or_hash: str) -> str:
    """
    Get a hash identifier for a repository URL.
    Maintains backward compatibility with existing code.
    """
    return get_repo_hash(repo_url_or_hash)


class Job(SQLModel, table=True):
    __tablename__ = "jobs"
    id: str = Field(primary_key=True, max_length=64)
    repo_identifier: str = Field(max_length=64, index=True)
    job_type: str = Field(max_length=32)
    status: str = Field(default="pending", max_length=16)
    progress_current: int = Field(default=0)
    progress_total: int = Field(default=0)
    progress_message: str = Field(default="", max_length=256)
    error_message: Optional[str] = Field(default=None, max_length=1024)
    result_json: Optional[str] = Field(default=None, sa_type=Text)
    created_at: datetime.datetime = Field(default_factory=_utc_now)
    updated_at: datetime.datetime = Field(default_factory=_utc_now, sa_column_kwargs={"onupdate": _utc_now})


class ScanHistory(SQLModel, table=True):
    __tablename__ = "scan_history"
    id: Optional[int] = Field(default=None, primary_key=True)
    repo_identifier: str = Field(max_length=64, index=True)
    health_score: float = Field(default=0.0)
    complexity_score: float = Field(default=0.0)
    test_coverage: float = Field(default=0.0)
    doc_coverage: float = Field(default=0.0)
    issues_json: Optional[str] = Field(default=None, sa_type=Text)
    scanned_at: datetime.datetime = Field(default_factory=_utc_now)


class GitHubConnection(SQLModel, table=True):
    __tablename__ = "github_connections"
    id: Optional[int] = Field(default=None, primary_key=True)
    repo_identifier: str = Field(max_length=64, index=True)
    installation_id: str = Field(max_length=64)
    github_repo_full_name: str = Field(max_length=256)
    connected_at: datetime.datetime = Field(default_factory=_utc_now)


class AutoFixPR(SQLModel, table=True):
    __tablename__ = "autofix_prs"
    id: Optional[int] = Field(default=None, primary_key=True)
    repo_identifier: str = Field(max_length=64, index=True)
    pr_url: str = Field(max_length=512)
    pr_number: int = Field(default=0)
    issues_fixed_json: Optional[str] = Field(default=None, sa_type=Text)
    created_at: datetime.datetime = Field(default_factory=_utc_now)


class ResponseCache(SQLModel, table=True):
    __tablename__ = "response_cache"
    cache_key: str = Field(primary_key=True, max_length=128)
    value_json: str = Field(sa_type=Text)
    created_at: datetime.datetime = Field(default_factory=_utc_now)
