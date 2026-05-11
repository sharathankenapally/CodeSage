import { Router, type IRouter, type Request, type Response } from "express";
import { eq, and } from "drizzle-orm";
import { db, analysesTable, repositoriesTable, analysisResultsTable } from "@workspace/db";
import {
  RunAnalysisStepParams,
  RunFullAnalysisParams,
} from "@workspace/api-zod";
import OpenAI from "openai";

const openrouter = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY ?? "",
});

const router: IRouter = Router();

const STEP_NAMES: Record<number, string> = {
  1: "Repository Discovery",
  2: "Business Logic Classification",
  3: "Business Rule Extraction",
  4: "Memory & State Dependency Map",
  5: "Microservice Grouping Proposal",
  6: "Requirements Document",
};

type RepoRecord = { name: string; javaCode: string; packageStructure: string | null };

const LANG_SIGNATURES: Array<{ exts: string[]; label: string; codeBlock: string }> = [
  { exts: [".py", ".pyw"],                       label: "Python",              codeBlock: "python"     },
  { exts: [".go"],                               label: "Go",                  codeBlock: "go"         },
  { exts: [".java"],                             label: "Java",                codeBlock: "java"       },
  { exts: [".kt", ".kts"],                       label: "Kotlin",              codeBlock: "kotlin"     },
  { exts: [".scala"],                            label: "Scala",               codeBlock: "scala"      },
  { exts: [".rs"],                               label: "Rust",                codeBlock: "rust"       },
  { exts: [".cs"],                               label: "C#",                  codeBlock: "csharp"     },
  { exts: [".cpp", ".cc", ".cxx"],               label: "C++",                 codeBlock: "cpp"        },
  { exts: [".c"],                                label: "C",                   codeBlock: "c"          },
  { exts: [".rb", ".rake"],                      label: "Ruby",                codeBlock: "ruby"       },
  { exts: [".php"],                              label: "PHP",                 codeBlock: "php"        },
  { exts: [".swift"],                            label: "Swift",               codeBlock: "swift"      },
  { exts: [".ex", ".exs"],                       label: "Elixir",              codeBlock: "elixir"     },
  { exts: [".ts"],                               label: "TypeScript",          codeBlock: "typescript" },
  { exts: [".js", ".mjs", ".cjs"],              label: "JavaScript",          codeBlock: "javascript" },
];

function detectLanguages(code: string): string {
  const found: string[] = [];
  for (const sig of LANG_SIGNATURES) {
    if (sig.exts.some(ext => code.includes(`FILE: `) && code.includes(ext))) {
      found.push(sig.label);
    }
  }
  return found.length > 0 ? found.join(", ") : "backend";
}

function codeBlockLang(code: string): string {
  for (const sig of LANG_SIGNATURES) {
    if (sig.exts.some(ext => code.includes(`FILE: `) && code.includes(ext))) {
      return sig.codeBlock;
    }
  }
  return "text";
}

function codeBlock(repo: RepoRecord): string {
  const lang = codeBlockLang(repo.javaCode);
  return `### Repository: ${repo.name}
${repo.packageStructure ? `\nFile Structure:\n${repo.packageStructure}\n` : ""}
\`\`\`${lang}
${repo.javaCode}
\`\`\``;
}

const STEP_PROMPTS: Record<number, (repos: RepoRecord[], previousResults: string) => string> = {
  1: (repos) => {
    const lang = detectLanguages(repos.map(r => r.javaCode).join("\n"));
    return `You are an expert software architect. Analyze the following ${lang} codebase(s) and produce a structured inventory.

## STEP 1 — Repository Discovery

${repos.map(codeBlock).join("\n\n")}

For each repository produce:
1. A Markdown table listing every source file, its purpose, and how many functions/classes it contains.
2. A list of all classes and standalone functions found.
3. Notable third-party libraries or frameworks imported.
4. A brief summary (2–4 sentences) of what the codebase does.

Use this exact format:

## Repository Inventory

### [Repo Name]

#### Module Inventory
| Module | Purpose (brief) | Classes | Functions |
|--------|-----------------|---------|-----------|
| ...    | ...             | ...     | ...       |

#### Key Imports / Dependencies
- [library] — [why it is used]

#### Summary
[2–4 sentences about what this codebase does overall]`;
  },

  2: (repos, previousResults) => {
    const lang = detectLanguages(repos.map(r => r.javaCode).join("\n"));
    return `You are an expert software architect analyzing a ${lang} codebase.

## STEP 2 — Business Logic Classification

Step 1 results:
${previousResults}

Classify every function and class method found in these repositories:

${repos.map(codeBlock).join("\n\n")}

Assign exactly one category per function/method:

- ✅ **Business Rule** — Calculations, validations, threshold checks, domain decisions
- ✅ **Orchestration** — Coordinates 2+ business rules or process steps in sequence
- ❌ **Data Access** — Reads/writes DB, files, queues, external APIs, caches (EXCLUDE)
- ❌ **Infrastructure** — Logging, config, retry logic, connection management (EXCLUDE)
- ❌ **UI/Presentation** — Rendering, serialization, HTTP handlers (EXCLUDE)

Classification guidance:
- if/else, switch, calculation, validation, threshold → Business Rule
- calls 2+ business functions in sequence → Orchestration
- SQL, ORM, HTTP client, file I/O, cache → Data Access (exclude)
- Unknown purpose → ⚠️ NEEDS HUMAN REVIEW

For each module produce:

### Module: [filename]

| Function/Method | Category | Include | Notes |
|-----------------|----------|---------|-------|
| ...             | ...      | Yes/No  | ...   |`;
  },

  3: (repos, previousResults) => {
    const lang = detectLanguages(repos.map(r => r.javaCode).join("\n"));
    return `You are an expert software architect analyzing a ${lang} codebase.

## STEP 3 — Business Rule Extraction

Steps 1–2 results:
${previousResults}

Extract every business rule from these repositories:

${repos.map(codeBlock).join("\n\n")}

For every function classified ✅ Business Rule or ✅ Orchestration in Step 2, produce:

### [ModuleName] — [ClassName or "module-level"]

#### Rule: [Short descriptive name]
- **Function/Method:** \`functionName(params)\`
- **Plain English:** [1–3 sentences — what this rule does, no code]
- **Inputs:** [name: type — what it represents]
- **Output / Decision:** [what it returns or which branch it takes]
- **Edge Cases / Conditions:** [guards, exception paths, notable branches]
- **Suggested Service:** [which microservice or module owns this rule]

Instructions:
1. Never include DB queries, HTTP calls, or logging
2. If a function mixes data access with logic, extract ONLY the logic and note it
3. Flag constants and thresholds as potential business rules
4. Unknown purpose → ⚠️ NEEDS HUMAN REVIEW
5. Decompose large if/else chains — each branch is usually its own rule`;
  },

  4: (_repos, previousResults) => {
    return `You are an expert software architect.

## STEP 4 — Memory & State Dependency Map

Based on the full analysis below, identify all in-memory state, module-level variables, and stateful dependencies discovered in Steps 1–3.

Prior analysis:
${previousResults}

For each module that holds or mutates state (maps, dicts, arrays, class fields, global/module-level vars, caches), produce:

### Memory Dependency: [module — ClassName or module scope]

- **Type of state:** [map / dict / array / class field / global variable / cache / singleton / etc.]
- **Variable name:** \`variableName\`
- **Access pattern:** READ / WRITE / BOTH
- **Keys or fields used:** [how data is indexed or accessed]
- **Business context:** [which rule or decision depends on this state]
- **Migration note:** [suggested replacement — Redis, DB table, passed as arg, etc.]

If a module has no in-memory state, state that explicitly.
Also identify any cross-module shared state (variables exported and imported by multiple files).`;
  },

  5: (_repos, previousResults) => {
    return `You are an expert software architect.

## STEP 5 — Microservice Grouping Proposal

Using the full prior analysis below, group the extracted business rules into logical service boundaries using domain-driven design principles. Group by bounded context (business domain), NOT by technical layer.

Prior analysis:
${previousResults}

For each proposed service or module produce:

## Proposed Service: [ServiceName]

- **Responsibility:** [One sentence — what this service owns and does]
- **Business rules it owns:** [rule names from Step 3]
- **Data it needs:** [data models and state from Step 4]
- **APIs it would expose:** [REST endpoints or events, with HTTP method and path]
- **Dependencies on other services:** [upstream/downstream calls needed]
- **Out of scope:** [what this service explicitly does NOT handle]

End with a plain-text **Dependency Graph** showing how services relate to each other.`;
  },

  6: (_repos, previousResults) => {
    return `You are an expert software architect.

## STEP 6 — Requirements Document

Generate a complete requirements document in plain English from the analysis below. No code, no implementation details.

Full prior analysis:
${previousResults}

---

# Codebase Requirements Report

## Executive Summary
[3–5 sentences for a non-technical stakeholder — what the system does and its value]

## System Overview
[Purpose, users, and core domain of the system]

---

For each proposed service from Step 5:

# Requirements: [ServiceName]

## Purpose
[1 paragraph — what this service does and why it exists]

## Functional Requirements
1. [Plain-English requirement]
2. ...

## Business Rules
1. **[Rule name]** — [plain-English description: inputs, logic, and outcome]
2. ...

## Data Requirements
- [What data this service reads and writes, in plain English]

## API Contract
- \`[METHOD] /[endpoint]\` — [what it accepts and returns]

## Out of Scope
- [What this service does NOT do]

---

## Flagged Items ⚠️
All items marked ⚠️ NEEDS HUMAN REVIEW with context on why human judgment is needed.

---

## Consolidated Services Overview

| Service | Responsibility | Depends On |
|---------|----------------|------------|
| ...     | ...            | ...        |`;
  },
};

async function runStep(
  analysisId: number,
  step: number,
  repos: RepoRecord[],
  previousResults: string,
  res: Response
): Promise<string> {
  const stepName = STEP_NAMES[step];
  const promptFn = STEP_PROMPTS[step];

  if (!promptFn) {
    throw new Error(`Invalid step: ${step}`);
  }

  const prompt = promptFn(repos, previousResults);

  res.write(`data: ${JSON.stringify({ step, stepName, status: "starting" })}\n\n`);

  const stream = await openrouter.chat.completions.create({
    model: "google/gemini-2.0-flash-exp:free",
    max_tokens: 4096,
    messages: [
      {
        role: "system",
        content:
          "You are an expert software architect specializing in analyzing codebases and producing structured business and functional requirements. Produce detailed, well-structured Markdown output following the given format exactly. Be thorough, specific, and actionable. Flag anything unclear with ⚠️ NEEDS HUMAN REVIEW.",
      },
      { role: "user", content: prompt },
    ],
    stream: true,
  });

  let fullContent = "";
  for await (const chunk of stream) {
    const content = chunk.choices[0]?.delta?.content;
    if (content) {
      fullContent += content;
      res.write(`data: ${JSON.stringify({ content })}\n\n`);
    }
  }

  await db
    .delete(analysisResultsTable)
    .where(
      and(
        eq(analysisResultsTable.analysisId, analysisId),
        eq(analysisResultsTable.step, step),
      ),
    );

  await db.insert(analysisResultsTable).values({
    analysisId,
    step,
    stepName,
    content: fullContent,
  });

  return fullContent;
}

router.post("/analyze/:id/step/:step", async (req: Request, res: Response): Promise<void> => {
  const params = RunAnalysisStepParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const { id, step } = params.data;

  const [analysis] = await db
    .select()
    .from(analysesTable)
    .where(eq(analysesTable.id, id));

  if (!analysis) {
    res.status(404).json({ error: "Analysis not found" });
    return;
  }

  const repos = await db
    .select()
    .from(repositoriesTable)
    .where(eq(repositoriesTable.analysisId, id));

  if (repos.length === 0) {
    res.status(400).json({ error: "No repositories added to this analysis" });
    return;
  }

  const previousResultRows = await db
    .select()
    .from(analysisResultsTable)
    .where(eq(analysisResultsTable.analysisId, id))
    .orderBy(analysisResultsTable.step);

  const previousResults = previousResultRows
    .map((r) => `## Step ${r.step}: ${r.stepName}\n${r.content}`)
    .join("\n\n---\n\n");

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  await db
    .update(analysesTable)
    .set({ status: "in_progress", currentStep: step, updatedAt: new Date() })
    .where(eq(analysesTable.id, id));

  try {
    await runStep(id, step, repos, previousResults, res);

    await db
      .update(analysesTable)
      .set({ status: "completed", updatedAt: new Date() })
      .where(eq(analysesTable.id, id));

    res.write(`data: ${JSON.stringify({ done: true, step, stepName: STEP_NAMES[step] })}\n\n`);
  } catch (err) {
    await db
      .update(analysesTable)
      .set({ status: "failed", updatedAt: new Date() })
      .where(eq(analysesTable.id, id));
    const msg = err instanceof Error ? err.message : "Unknown error";
    res.write(`data: ${JSON.stringify({ error: msg })}\n\n`);
  }

  res.end();
});

router.post("/analyze/:id/full", async (req: Request, res: Response): Promise<void> => {
  const params = RunFullAnalysisParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const { id } = params.data;

  const [analysis] = await db
    .select()
    .from(analysesTable)
    .where(eq(analysesTable.id, id));

  if (!analysis) {
    res.status(404).json({ error: "Analysis not found" });
    return;
  }

  const repos = await db
    .select()
    .from(repositoriesTable)
    .where(eq(repositoriesTable.analysisId, id));

  if (repos.length === 0) {
    res.status(400).json({ error: "No repositories added to this analysis" });
    return;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  await db
    .update(analysesTable)
    .set({ status: "in_progress", currentStep: 1, updatedAt: new Date() })
    .where(eq(analysesTable.id, id));

  await db
    .delete(analysisResultsTable)
    .where(eq(analysisResultsTable.analysisId, id));

  try {
    let cumulativeResults = "";

    for (let step = 1; step <= 6; step++) {
      await db
        .update(analysesTable)
        .set({ currentStep: step, updatedAt: new Date() })
        .where(eq(analysesTable.id, id));

      res.write(`data: ${JSON.stringify({ stepTransition: true, step, stepName: STEP_NAMES[step] })}\n\n`);

      const content = await runStep(id, step, repos, cumulativeResults, res);
      cumulativeResults += `\n\n## Step ${step}: ${STEP_NAMES[step]}\n${content}`;

      res.write(`data: ${JSON.stringify({ stepComplete: true, step, stepName: STEP_NAMES[step] })}\n\n`);
    }

    await db
      .update(analysesTable)
      .set({ status: "completed", updatedAt: new Date() })
      .where(eq(analysesTable.id, id));

    res.write(`data: ${JSON.stringify({ done: true, allStepsComplete: true })}\n\n`);
  } catch (err) {
    await db
      .update(analysesTable)
      .set({ status: "failed", updatedAt: new Date() })
      .where(eq(analysesTable.id, id));
    const msg = err instanceof Error ? err.message : "Unknown error";
    res.write(`data: ${JSON.stringify({ error: msg })}\n\n`);
  }

  res.end();
});

export default router;
