"""
config.py — Configuration variables for ai_code_analyzer.

Set OPENAI_API_KEY and GITHUB_TOKEN as environment variables,
or provide them directly when calling the analysis functions.
"""

import os

# OpenAI
OPENAI_API_KEY: str = os.environ.get("OPENAI_API_KEY", "")
OPENAI_MODEL: str = os.environ.get("OPENAI_MODEL", "gpt-4o")
OPENAI_MAX_TOKENS: int = int(os.environ.get("OPENAI_MAX_TOKENS", "8192"))

# GitHub
GITHUB_TOKEN: str = os.environ.get("GITHUB_TOKEN", "")
REPO_URL: str = os.environ.get("REPO_URL", "")
BRANCH: str = os.environ.get("BRANCH", "")

# Analysis limits
MAX_FILES: int = int(os.environ.get("MAX_FILES", "100"))
BATCH_SIZE: int = int(os.environ.get("BATCH_SIZE", "10"))

# Output
OUTPUT_DIR: str = os.environ.get("OUTPUT_DIR", "outputs")

PYTHON_EXTENSIONS = [".py"]
IGNORE_PATH_FRAGMENTS = [
    "__pycache__", ".egg-info", "migrations", "node_modules",
    ".git", "venv", ".venv", "dist", "build", ".tox", ".pytest_cache",
]
