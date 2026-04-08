"""
main.py — Entry point: orchestrates the full Python repository analysis pipeline.

Usage:
    python -m ai_code_analyzer.main --repo https://github.com/owner/repo
    python -m ai_code_analyzer.main --repo https://github.com/owner/repo --branch main --token ghp_xxx

Or import directly:
    from ai_code_analyzer.main import run_analysis
    results = run_analysis(repo_url="https://github.com/owner/repo")
"""

from __future__ import annotations

import argparse
import sys
from typing import Optional

from ai_code_analyzer.config import REPO_URL, GITHUB_TOKEN, BRANCH, OUTPUT_DIR
from ai_code_analyzer.repo_manager import fetch_repo, concatenate_code
from ai_code_analyzer.code_parser import parse_all, summarize_modules
from ai_code_analyzer.ai_analyzer import AIAnalyzer, STEP_NAMES
from ai_code_analyzer.report_generator import (
    save_step_result,
    save_full_analysis,
    save_per_service_requirements,
)


def run_analysis(
    repo_url: str,
    branch: Optional[str] = None,
    token: Optional[str] = None,
    output_dir: str = OUTPUT_DIR,
    steps: Optional[list[int]] = None,
    verbose: bool = True,
) -> dict[int, str]:
    """
    Run the full 6-step Python codebase analysis.

    Args:
        repo_url:   GitHub repository URL.
        branch:     Branch to fetch (defaults to the repo's default branch).
        token:      GitHub personal access token (required for private repos).
        output_dir: Directory where Markdown reports are written.
        steps:      Specific steps to run (default: all 6).
        verbose:    Print progress to stdout.

    Returns:
        Dict mapping step number → Markdown result string.
    """
    steps = steps or list(range(1, 7))

    def log(msg: str) -> None:
        if verbose:
            print(msg)

    # ── Step 0: Fetch repository ─────────────────────────────────────────────
    log(f"\n🔍 Fetching repository: {repo_url}")
    fetch_result = fetch_repo(repo_url, branch=branch, token=token)
    log(f"   ✓ {fetch_result.file_count} Python files fetched from {fetch_result.name}")
    if fetch_result.truncated:
        log("   ⚠ Results truncated at 100 files")

    # ── Step 0b: Parse code structure ────────────────────────────────────────
    log("\n📂 Parsing code structure...")
    modules = parse_all(fetch_result.files)
    code_summary = summarize_modules(modules)
    full_code = concatenate_code(fetch_result)
    log(f"   ✓ {len(modules)} modules parsed")

    # ── Steps 1–6: AI analysis ───────────────────────────────────────────────
    analyzer = AIAnalyzer()
    results: dict[int, str] = {}
    cumulative = ""

    for step in steps:
        step_name = STEP_NAMES[step]
        log(f"\n🤖 Step {step}: {step_name} ...")

        content = analyzer.run_step(
            step=step,
            code=full_code,
            previous_results=cumulative,
        )
        results[step] = content
        cumulative += f"\n\n## Step {step}: {step_name}\n{content}"

        path = save_step_result(step, content, fetch_result.name, output_dir)
        log(f"   ✓ Saved → {path}")

    # ── Save consolidated report ──────────────────────────────────────────────
    if len(results) == 6:
        full_path = save_full_analysis(results, fetch_result.name, output_dir)
        log(f"\n📄 Full analysis → {full_path}")

    if 6 in results:
        service_paths = save_per_service_requirements(results[6], fetch_result.name, output_dir)
        for p in service_paths:
            log(f"   ✓ Service requirements → {p}")

    log(f"\n✅ Analysis complete. Reports saved to: {output_dir}/")
    return results


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Analyze a Python GitHub repository and generate business requirements."
    )
    parser.add_argument("--repo", default=REPO_URL, help="GitHub repository URL")
    parser.add_argument("--branch", default=BRANCH or None, help="Branch name (default: repo default)")
    parser.add_argument("--token", default=GITHUB_TOKEN or None, help="GitHub personal access token")
    parser.add_argument("--output", default=OUTPUT_DIR, help=f"Output directory (default: {OUTPUT_DIR})")
    parser.add_argument(
        "--steps",
        nargs="+",
        type=int,
        choices=range(1, 7),
        metavar="N",
        help="Steps to run (1–6, default: all)",
    )
    args = parser.parse_args()

    if not args.repo:
        print("Error: --repo is required (or set REPO_URL env variable)", file=sys.stderr)
        sys.exit(1)

    run_analysis(
        repo_url=args.repo,
        branch=args.branch,
        token=args.token,
        output_dir=args.output,
        steps=args.steps,
    )


if __name__ == "__main__":
    main()
