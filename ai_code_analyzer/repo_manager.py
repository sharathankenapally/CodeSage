"""
repo_manager.py — Fetches Python source files from a GitHub repository.

Supports public repos (no token needed) and private repos (GitHub token required).
Returns a list of (file_path, source_code) tuples and a file tree string.
"""

import base64
import re
from typing import Optional
from dataclasses import dataclass

try:
    import requests
except ImportError:
    raise ImportError("Install the 'requests' package: pip install requests")

from ai_code_analyzer.config import (
    GITHUB_TOKEN,
    MAX_FILES,
    BATCH_SIZE,
    PYTHON_EXTENSIONS,
    IGNORE_PATH_FRAGMENTS,
)


@dataclass
class FetchResult:
    name: str
    files: list[tuple[str, str]]
    package_structure: str
    file_count: int
    truncated: bool


def _parse_github_url(url: str) -> tuple[str, str]:
    """Parse 'https://github.com/owner/repo' → ('owner', 'repo')."""
    cleaned = url.strip().rstrip("/").removesuffix(".git")
    match = re.search(r"github\.com[/:]([^/]+)/([^/]+)", cleaned)
    if not match:
        raise ValueError(f"Invalid GitHub URL: {url}")
    return match.group(1), match.group(2)


def _is_python_file(path: str) -> bool:
    if any(frag in path for frag in IGNORE_PATH_FRAGMENTS):
        return False
    return any(path.endswith(ext) for ext in PYTHON_EXTENSIONS)


def _github_headers(token: Optional[str] = None) -> dict:
    headers = {
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "PythonCodeAnalyzer/1.0",
    }
    tok = token or GITHUB_TOKEN
    if tok:
        headers["Authorization"] = f"Bearer {tok}"
    return headers


def _build_file_tree(paths: list[str]) -> str:
    """Build an ASCII tree string from a list of file paths."""
    tree: dict = {}
    for p in paths:
        node = tree
        for part in p.split("/"):
            node = node.setdefault(part, {})

    lines: list[str] = []

    def _render(node: dict, prefix: str) -> None:
        keys = sorted(node.keys())
        for i, key in enumerate(keys):
            is_last = i == len(keys) - 1
            connector = "└── " if is_last else "├── "
            child_prefix = "    " if is_last else "│   "
            lines.append(f"{prefix}{connector}{key}")
            if node[key]:
                _render(node[key], prefix + child_prefix)

    _render(tree, "")
    return "\n".join(lines)


def fetch_repo(
    repo_url: str,
    branch: Optional[str] = None,
    token: Optional[str] = None,
    max_files: int = MAX_FILES,
) -> FetchResult:
    """
    Fetch all Python (.py) files from a GitHub repository.

    Args:
        repo_url:  GitHub repository URL (e.g. https://github.com/owner/repo)
        branch:    Branch name; defaults to the repo's default branch.
        token:     GitHub personal access token (required for private repos).
        max_files: Maximum number of Python files to fetch.

    Returns:
        FetchResult with files, file tree, and metadata.
    """
    owner, repo = _parse_github_url(repo_url)
    headers = _github_headers(token)
    base = "https://api.github.com"

    # Resolve default branch
    if not branch:
        resp = requests.get(f"{base}/repos/{owner}/{repo}", headers=headers, timeout=30)
        resp.raise_for_status()
        branch = resp.json()["default_branch"]

    # Fetch recursive tree
    resp = requests.get(
        f"{base}/repos/{owner}/{repo}/git/trees/{branch}?recursive=1",
        headers=headers,
        timeout=30,
    )
    resp.raise_for_status()
    tree_data = resp.json()

    python_items = [
        item for item in tree_data.get("tree", [])
        if item["type"] == "blob" and _is_python_file(item["path"])
    ][:max_files]

    if not python_items:
        raise ValueError(
            f"No Python (.py) files found in {owner}/{repo} on branch '{branch}'."
        )

    file_paths = [item["path"] for item in python_items]
    package_structure = _build_file_tree(file_paths)

    # Fetch file contents in batches
    files: list[tuple[str, str]] = []
    for i in range(0, len(python_items), BATCH_SIZE):
        batch = python_items[i : i + BATCH_SIZE]
        for item in batch:
            try:
                r = requests.get(
                    f"{base}/repos/{owner}/{repo}/contents/{item['path']}?ref={branch}",
                    headers=headers,
                    timeout=30,
                )
                if not r.ok:
                    continue
                data = r.json()
                if data.get("encoding") == "base64":
                    content = base64.b64decode(
                        data["content"].replace("\n", "")
                    ).decode("utf-8", errors="replace")
                    files.append((item["path"], content))
            except Exception:
                continue

    is_truncated = tree_data.get("truncated", False) or len(python_items) == max_files

    return FetchResult(
        name=f"{owner}/{repo}",
        files=files,
        package_structure=package_structure,
        file_count=len(files),
        truncated=is_truncated,
    )


def concatenate_code(fetch_result: FetchResult) -> str:
    """Concatenate all fetched file contents into a single string."""
    parts = []
    for path, code in fetch_result.files:
        parts.append(f"# ===== FILE: {path} =====\n{code}\n")
    return "\n".join(parts)
