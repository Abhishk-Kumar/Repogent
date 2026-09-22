import json
import logging
import time
from typing import Optional

import httpx
from app.config import settings

logger = logging.getLogger(__name__)

GITHUB_API = "https://api.github.com"


def _create_jwt() -> str:
    import jwt as pyjwt
    now = int(time.time())
    payload = {
        "iat": now - 60,
        "exp": now + 600,
        "iss": settings.github_app_id,
    }
    private_key = settings.github_app_private_key.replace("\\n", "\n")
    return pyjwt.encode(payload, private_key, algorithm="RS256")


async def get_installation_token(installation_id: str) -> Optional[str]:
    jwt_token = _create_jwt()
    headers = {
        "Authorization": f"Bearer {jwt_token}",
        "Accept": "application/vnd.github.v3+json",
    }
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"{GITHUB_API}/app/installations/{installation_id}/access_tokens",
            headers=headers,
        )
        if resp.status_code == 201:
            data = resp.json()
            return data.get("token")
        logger.error("Failed to get installation token: %s %s", resp.status_code, resp.text)
        return None


async def get_default_branch(owner: str, repo: str, token: str) -> Optional[str]:
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{GITHUB_API}/repos/{owner}/{repo}",
            headers={"Authorization": f"Bearer {token}", "Accept": "application/vnd.github.v3+json"},
        )
        if resp.status_code == 200:
            return resp.json().get("default_branch")
        logger.error("Failed to get repo info: %s", resp.text)
        return None


async def get_latest_commit_sha(owner: str, repo: str, branch: str, token: str) -> Optional[str]:
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{GITHUB_API}/repos/{owner}/{repo}/git/ref/heads/{branch}",
            headers={"Authorization": f"Bearer {token}", "Accept": "application/vnd.github.v3+json"},
        )
        if resp.status_code == 200:
            return resp.json().get("object", {}).get("sha")
        logger.error("Failed to get branch ref: %s", resp.text)
        return None


async def create_branch(owner: str, repo: str, new_branch: str, sha: str, token: str) -> bool:
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"{GITHUB_API}/repos/{owner}/{repo}/git/refs",
            json={"ref": f"refs/heads/{new_branch}", "sha": sha},
            headers={"Authorization": f"Bearer {token}", "Accept": "application/vnd.github.v3+json"},
        )
        if resp.status_code == 201:
            logger.info("Branch %s created", new_branch)
            return True
        logger.error("Failed to create branch: %s", resp.text)
        return False


async def commit_file(
    owner: str,
    repo: str,
    branch: str,
    file_path: str,
    content: str,
    message: str,
    token: str,
    sha: Optional[str] = None,
) -> Optional[str]:
    import base64
    encoded = base64.b64encode(content.encode()).decode()
    data = {"message": message, "branch": branch, "content": encoded}
    if sha:
        data["sha"] = sha

    async with httpx.AsyncClient() as client:
        url = f"{GITHUB_API}/repos/{owner}/{repo}/contents/{file_path}"
        resp = await client.put(
            url,
            json=data,
            headers={"Authorization": f"Bearer {token}", "Accept": "application/vnd.github.v3+json"},
        )
        if resp.status_code in (200, 201):
            logger.info("Committed %s", file_path)
            return resp.json().get("content", {}).get("sha")
        logger.error("Failed to commit %s: %s", file_path, resp.text)
        return None


async def create_pr(
    owner: str,
    repo: str,
    title: str,
    body: str,
    head_branch: str,
    base_branch: str,
    token: str,
) -> Optional[dict]:
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"{GITHUB_API}/repos/{owner}/{repo}/pulls",
            json={"title": title, "body": body, "head": head_branch, "base": base_branch},
            headers={"Authorization": f"Bearer {token}", "Accept": "application/vnd.github.v3+json"},
        )
        if resp.status_code == 201:
            data = resp.json()
            logger.info("PR created: %s", data.get("html_url"))
            return {"url": data.get("html_url"), "number": data.get("number")}
        logger.error("Failed to create PR: %s", resp.text)
        return None


async def post_pr_comment(owner: str, repo: str, pr_number: int, body: str, token: str) -> bool:
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"{GITHUB_API}/repos/{owner}/{repo}/issues/{pr_number}/comments",
            json={"body": body},
            headers={"Authorization": f"Bearer {token}", "Accept": "application/vnd.github.v3+json"},
        )
        if resp.status_code == 201:
            logger.info("Comment posted on PR #%d", pr_number)
            return True
        logger.error("Failed to post comment: %s", resp.text)
        return False
