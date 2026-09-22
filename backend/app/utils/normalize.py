import re
import hashlib
import subprocess
import logging
import urllib.parse

logger = logging.getLogger(__name__)


def normalize_repo_url(repo_url: str) -> str:
    """
    Normalize a repository URL to a consistent string identifier.
    
    Rules:
    1. Strip protocol (http://, https://, git@)
    2. Remove .git suffix
    3. Remove trailing slash
    4. Convert to lowercase
    5. Remove 'www.' prefix
    6. Normalize git@github.com:owner/repo to github.com/owner/repo
    
    Returns a normalized string like "github.com/owner/repo"
    """
    if not repo_url:
        return ""
    
    url = repo_url.strip()
    
    # Convert git@ URLs to HTTPS format
    if url.startswith("git@"):
        # git@github.com:owner/repo -> github.com/owner/repo
        url = re.sub(r"^git@([^:]+):", r"\1/", url)
    
    # Remove protocol
    url = re.sub(r"^(https?://|ssh://)", "", url, flags=re.IGNORECASE)
    
    # Remove www. prefix
    url = re.sub(r"^www\.", "", url, flags=re.IGNORECASE)
    
    # Remove .git suffix
    url = re.sub(r"\.git$", "", url)
    
    # Remove trailing slash
    url = url.rstrip("/")
    
    # Convert to lowercase for consistency
    url = url.lower()
    
    return url


def get_repo_hash(repo_url: str) -> str:
    """
    Get a hash identifier for a repository URL.
    Uses the normalized URL as input to ensure consistency.
    """
    normalized = normalize_repo_url(repo_url)
    return hashlib.sha256(normalized.encode()).hexdigest()[:16]


def get_cache_key(repo_url: str, commit_sha: str = "") -> str:
    """
    Build a cache key for a repository.
    Uses the normalized URL and optional commit SHA.
    """
    normalized = normalize_repo_url(repo_url)
    raw = f"{normalized}::{commit_sha}"
    return hashlib.sha256(raw.encode()).hexdigest()[:32]


def get_latest_commit_sha(repo_url: str) -> str:
    """
    Fetch the latest commit SHA for a repository.
    Uses git ls-remote for Git URLs or GitHub API for GitHub URLs.
    Returns empty string if unable to fetch.
    """
    if not repo_url:
        return ""
    
    normalized = normalize_repo_url(repo_url)
    
    try:
        # Check if it's a GitHub URL
        if "github.com" in normalized:
            # Extract owner/repo from github.com/owner/repo
            parts = normalized.split("github.com/")
            if len(parts) > 1:
                repo_path = parts[1]
                # Use GitHub API to get latest commit
                import requests
                api_url = f"https://api.github.com/repos/{repo_path}/commits"
                response = requests.get(api_url, timeout=10)
                if response.status_code == 200:
                    commits = response.json()
                    if commits and len(commits) > 0:
                        return commits[0]["sha"]
        
        # Fallback: try git ls-remote
        # Build a git URL for ls-remote
        git_url = repo_url
        if not (git_url.startswith("http://") or git_url.startswith("https://") or git_url.startswith("git@")):
            git_url = f"https://{git_url}"
        if not git_url.endswith(".git"):
            git_url += ".git"
            
        result = subprocess.run(
            ["git", "ls-remote", git_url, "HEAD"],
            capture_output=True,
            text=True,
            timeout=10
        )
        if result.returncode == 0:
            lines = result.stdout.strip().split("\n")
            for line in lines:
                if line:
                    parts = line.split()
                    if len(parts) >= 1:
                        return parts[0]  # SHA
        
    except Exception as e:
        logger.warning("Failed to fetch commit SHA for %s: %s", repo_url, e)
    
    return ""  # Return empty string if unable to fetch