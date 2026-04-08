"""
ai_analyzer.py — Sends Python source code to the OpenAI API for business rule extraction.

Each of the 6 analysis steps produces a structured Markdown report.
Supports streaming (token-by-token) and non-streaming modes.
"""

from __future__ import annotations

from typing import Iterator, Optional

from ai_code_analyzer.config import OPENAI_API_KEY, OPENAI_MODEL, OPENAI_MAX_TOKENS

try:
    from openai import OpenAI
except ImportError:
    raise ImportError("Install the 'openai' package: pip install openai")


STEP_NAMES: dict[int, str] = {
    1: "Repository Discovery",
    2: "Business Logic Classification",
    3: "Business Rule Extraction",
    4: "Memory & State Dependency Map",
    5: "Microservice Grouping Proposal",
    6: "Requirements Document",
}

SYSTEM_PROMPT = (
    "You are an expert Python software architect specializing in analyzing codebases "
    "and producing structured business and functional requirements. "
    "Produce detailed, well-structured Markdown output following the given format exactly. "
    "Be thorough, specific, and actionable. "
    "Flag anything unclear with ⚠️ NEEDS HUMAN REVIEW."
)

_STEP_PROMPTS: dict[int, str] = {
    1: """## STEP 1 — Repository Discovery

Analyze the following Python repository and produce a structured inventory:

{code}

For each file, produce:
1. A Markdown table listing every Python module, its purpose, and how many functions/classes it contains.
2. A summary of the top-level package layout.
3. A list of all classes and standalone functions found.
4. Any notable third-party libraries imported.

## Repository Inventory

### Module Inventory
| Module | Purpose (brief) | Classes | Functions |
|--------|-----------------|---------|-----------|

### Key Imports
- [library] — [why it is used]

### Summary
[2–4 sentences about what this codebase does overall]""",

    2: """## STEP 2 — Business Logic Classification

Previous analysis:
{previous_results}

Analyze these Python files and classify every function and class method:

{code}

For every function or class method, assign exactly one category:
- ✅ Business Rule — Performs calculations, validations, threshold checks, or enforces a domain rule
- ✅ Orchestration — Coordinates multiple business rules or process steps
- ❌ Data Access — Reads/writes DB, files, external APIs, caches (EXCLUDE)
- ❌ Infrastructure — Logging, config, retry logic, connection management (EXCLUDE)
- ❌ UI/Frontend — Templates, view rendering, serialization (EXCLUDE)

For each module produce:

### Module: [filename.py]

| Function/Method | Category | Include | Notes |
|-----------------|----------|---------|-------|""",

    3: """## STEP 3 — Business Rule Extraction

Previous analysis:
{previous_results}

Extract all business rules from these Python files:

{code}

For every function classified as a Business Rule or Orchestration in Step 2:

### [ModuleName] — [ClassName or "module-level"]

#### Rule: [Short descriptive name]
- **Function/Method:** `function_name(params)`
- **Plain English:** [1–3 sentences, no code]
- **Inputs:** [parameter name: type — what it represents]
- **Output / Decision:** [what it returns or decides]
- **Edge Cases / Conditions:** [notable branches, guards, exceptions]
- **Suggested Module/Service:** [which microservice this belongs to]

Flag unclear functions with ⚠️ NEEDS HUMAN REVIEW.""",

    4: """## STEP 4 — Memory & State Dependency Map

Previous analysis:
{previous_results}

Identify all in-memory data structures and global state in these Python files:

{code}

For each module holding or mutating state (dicts, lists, class attributes, globals, caches):

### Memory Dependency: [module_name.py — ClassName or global scope]

- **Type of state:** [dict / list / set / class attribute / global variable / LRU cache / etc.]
- **Variable name:** `variable_name`
- **Access pattern:** READ / WRITE / BOTH
- **Keys or fields used:** [how the data is indexed]
- **Business context:** [what decision depends on this state]
- **Migration note:** [suggested replacement — e.g., Redis, database table, function argument]

Also map any cross-module shared state.""",

    5: """## STEP 5 — Microservice Grouping Proposal

Previous analysis:
{previous_results}

Group the business rules into logical microservice or module boundaries:

{code}

For each proposed service:

## Proposed Service: [ServiceName]

- **Responsibility:** [One clear sentence]
- **Business rules it owns:** [list from Step 3]
- **Data it needs:** [state dependencies from Step 4]
- **APIs it would expose:** [suggested REST endpoints or event interfaces]
- **Dependencies on other services:** [list]
- **Out of scope:** [what it does NOT handle]

End with a dependency graph in text form.""",

    6: """## STEP 6 — Requirements Document

Previous analysis:
{previous_results}

Generate a complete consolidated requirements document in plain English — no code, no implementation details.

{code}

---

# Python Codebase Requirements Report

## Executive Summary
[3–5 sentences for a non-technical stakeholder]

## System Overview
[Purpose, users, and core domain]

---

For each proposed microservice:

# Requirements: [ServiceName]

## Purpose
[1 paragraph]

## Functional Requirements
1. [Plain-English requirement]

## Business Rules
1. [Rule name] — [description, inputs, outcome]

## Data Requirements
- [What data this service reads and writes]

## API Contract
- `[METHOD] /[endpoint]` — [what it does]

## Out of Scope
- [What this service does NOT do]

---

## Flagged Items ⚠️
[All items marked NEEDS HUMAN REVIEW with context]

---

## Consolidated Microservices Overview
| Service | Responsibility | Depends On |
|---------|---------------|------------|""",
}


class AIAnalyzer:
    """Sends Python source code to OpenAI for step-by-step business rule extraction."""

    def __init__(self, api_key: Optional[str] = None, model: Optional[str] = None):
        self.client = OpenAI(api_key=api_key or OPENAI_API_KEY)
        self.model = model or OPENAI_MODEL

    def _build_prompt(self, step: int, code: str, previous_results: str = "") -> str:
        template = _STEP_PROMPTS.get(step)
        if not template:
            raise ValueError(f"Unknown step: {step}")
        return template.format(code=code, previous_results=previous_results)

    def run_step(
        self,
        step: int,
        code: str,
        previous_results: str = "",
    ) -> str:
        """
        Run a single analysis step and return the full Markdown result.

        Args:
            step:             Step number (1–6).
            code:             Concatenated Python source code.
            previous_results: Cumulative results from prior steps.

        Returns:
            Full Markdown string produced by the AI.
        """
        prompt = self._build_prompt(step, code, previous_results)
        response = self.client.chat.completions.create(
            model=self.model,
            max_completion_tokens=OPENAI_MAX_TOKENS,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": prompt},
            ],
        )
        return response.choices[0].message.content or ""

    def run_step_streaming(
        self,
        step: int,
        code: str,
        previous_results: str = "",
    ) -> Iterator[str]:
        """
        Run a single analysis step with streaming, yielding tokens as they arrive.

        Args:
            step:             Step number (1–6).
            code:             Concatenated Python source code.
            previous_results: Cumulative results from prior steps.

        Yields:
            Individual token strings.
        """
        prompt = self._build_prompt(step, code, previous_results)
        stream = self.client.chat.completions.create(
            model=self.model,
            max_completion_tokens=OPENAI_MAX_TOKENS,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": prompt},
            ],
            stream=True,
        )
        for chunk in stream:
            token = chunk.choices[0].delta.content
            if token:
                yield token
