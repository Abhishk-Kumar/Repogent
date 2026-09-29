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


class Ticket(SQLModel, table=True):
    """In-app ticket queue (04). Source of truth; works with zero integrations."""
    __tablename__ = "tickets"
    id: Optional[int] = Field(default=None, primary_key=True)
    repo_identifier: str = Field(max_length=64, index=True)
    repo_url: str = Field(default="", max_length=512)
    title: str = Field(max_length=512)
    description: str = Field(default="", sa_type=Text)
    severity: str = Field(default="medium", max_length=16)
    source_finding_id: str = Field(default="", max_length=128)
    status: str = Field(default="open", max_length=16)  # open | pushed
    jira_issue_key: Optional[str] = Field(default=None, max_length=64)
    jira_url: Optional[str] = Field(default=None, max_length=512)
    created_at: datetime.datetime = Field(default_factory=_utc_now)


class JiraConnection(SQLModel, table=True):
    """Per-user Jira Cloud OAuth tokens. Server-side only — never localStorage.
    Tokens are authenticated-encrypted at rest (see app.integrations.jira_oauth)."""
    __tablename__ = "jira_connections"
    id: Optional[int] = Field(default=None, primary_key=True)
    user_key: str = Field(default="default", max_length=128, index=True)
    site_url: str = Field(default="", max_length=512)
    site_name: str = Field(default="", max_length=256)
    encrypted_access_token: str = Field(default="", sa_type=Text)
    encrypted_refresh_token: str = Field(default="", sa_type=Text)
    expires_at: Optional[datetime.datetime] = Field(default=None)
    connected_at: datetime.datetime = Field(default_factory=_utc_now)


class SlackConnection(SQLModel, table=True):
    """Per-user Slack OAuth tokens (bot token). Server-side only — never localStorage.
    Tokens are authenticated-encrypted at rest (see app.integrations.slack_oauth)."""
    __tablename__ = "slack_connections"
    id: Optional[int] = Field(default=None, primary_key=True)
    user_key: str = Field(default="default", max_length=128, index=True)
    team_name: str = Field(default="", max_length=256)
    team_id: str = Field(default="", max_length=128)
    bot_user_id: str = Field(default="", max_length=128)
    bot_access_token: str = Field(default="", sa_type=Text)
    # 06.2 webhook fallback (encrypted at rest, same as the bot token).
    encrypted_webhook_url: str = Field(default="", sa_type=Text)
    # 06.1 notify-on-complete opt-in (fires once per scan — see jobs._run_scan).
    notify_on_complete: bool = Field(default=False)
    connected_at: datetime.datetime = Field(default_factory=_utc_now)


class ApiKey(SQLModel, table=True):
    """MCP server API keys — one per user/repo combination.
    Keys are hashed at rest (bcrypt), never stored in plaintext.
    Used for authenticating MCP server requests (stdio + HTTP transports)."""
    __tablename__ = "api_keys"
    id: Optional[int] = Field(default=None, primary_key=True)
    user_key: str = Field(default="default", max_length=128, index=True)
    repo_identifier: str = Field(max_length=64, index=True)
    key_hash: str = Field(max_length=128)
    key_prefix: str = Field(max_length=16, index=True)  # First 8 chars for identification
    name: str = Field(default="", max_length=128)  # User-friendly name
    is_active: bool = Field(default=True)
    created_at: datetime.datetime = Field(default_factory=_utc_now)
    last_used_at: Optional[datetime.datetime] = Field(default=None)
    revoked_at: Optional[datetime.datetime] = Field(default=None)
