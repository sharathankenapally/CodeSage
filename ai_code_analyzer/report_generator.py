"""
report_generator.py — Writes Markdown reports to the outputs/ directory.

Produces:
  outputs/repo_inventory.md           — Step 1 result
  outputs/microservices_proposal.md   — Step 5 result
  outputs/requirements-[service].md  — Per-service requirements (Step 6)
  outputs/full_analysis.md            — All 6 steps concatenated
"""

from __future__ import annotations

import os
import re
from datetime import datetime, timezone

from ai_code_analyzer.config import OUTPUT_DIR
from ai_code_analyzer.ai_analyzer import STEP_NAMES


def _ensure_output_dir(output_dir: str) -> None:
    os.makedirs(output_dir, exist_ok=True)


def _write_file(path: str, content: str) -> None:
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)
    print(f"  ✓ Written: {path}")


def save_step_result(
    step: int,
    content: str,
    repo_name: str,
    output_dir: str = OUTPUT_DIR,
) -> str:
    """
    Save an individual step result to the outputs directory.

    Returns the file path written.
    """
    _ensure_output_dir(output_dir)
    step_name = STEP_NAMES.get(step, f"step_{step}")
    slug = step_name.lower().replace(" ", "_").replace("&", "and")

    file_map = {
        1: "repo_inventory.md",
        2: "business_logic_classification.md",
        3: "business_rule_extraction.md",
        4: "memory_dependency_map.md",
        5: "microservices_proposal.md",
        6: "requirements_document.md",
    }
    filename = file_map.get(step, f"step_{step}_{slug}.md")
    path = os.path.join(output_dir, filename)

    header = (
        f"# {step_name}\n\n"
        f"> **Repository:** {repo_name}  \n"
        f"> **Generated:** {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}  \n"
        f"> **Step:** {step} of 6\n\n---\n\n"
    )
    _write_file(path, header + content)
    return path


def save_full_analysis(
    results: dict[int, str],
    repo_name: str,
    output_dir: str = OUTPUT_DIR,
) -> str:
    """
    Save all 6 step results into a single consolidated Markdown file.

    Args:
        results:    Dict mapping step number → Markdown content.
        repo_name:  Repository name shown in the header.
        output_dir: Directory to write files into.

    Returns:
        Path of the full_analysis.md file written.
    """
    _ensure_output_dir(output_dir)
    path = os.path.join(output_dir, "full_analysis.md")

    sections = [
        f"# Full Analysis Report\n\n"
        f"> **Repository:** {repo_name}  \n"
        f"> **Generated:** {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}\n\n"
        f"---\n"
    ]

    for step in sorted(results.keys()):
        step_name = STEP_NAMES.get(step, f"Step {step}")
        sections.append(f"\n## Step {step}: {step_name}\n\n{results[step]}\n\n---\n")

    _write_file(path, "\n".join(sections))
    return path


def extract_service_requirements(step6_content: str) -> dict[str, str]:
    """
    Parse the Step 6 output and split it into per-service requirement sections.

    Returns a dict of {service_name: markdown_content}.
    """
    services: dict[str, str] = {}
    pattern = re.compile(r"^# Requirements:\s*(.+)$", re.MULTILINE)
    matches = list(pattern.finditer(step6_content))

    for i, match in enumerate(matches):
        service_name = match.group(1).strip()
        start = match.start()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(step6_content)
        services[service_name] = step6_content[start:end].strip()

    return services


def save_per_service_requirements(
    step6_content: str,
    repo_name: str,
    output_dir: str = OUTPUT_DIR,
) -> list[str]:
    """
    Parse Step 6 output and write individual requirements-[service].md files.

    Returns a list of file paths written.
    """
    _ensure_output_dir(output_dir)
    services = extract_service_requirements(step6_content)
    paths = []

    for service_name, content in services.items():
        slug = re.sub(r"[^a-z0-9]+", "-", service_name.lower()).strip("-")
        path = os.path.join(output_dir, f"requirements-{slug}.md")
        header = (
            f"> **Repository:** {repo_name}  \n"
            f"> **Generated:** {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}\n\n---\n\n"
        )
        _write_file(path, header + content)
        paths.append(path)

    return paths
