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

function detectLanguage(code: string): string {
  const pyLines = (code.match(/^#.*(FILE:.*\.py)/gm) || []).length;
  const tsLines = (code.match(/^\/\/.*(FILE:.*\.(ts|js))/gm) || []).length;
  if (pyLines > tsLines) return "Python";
  if (tsLines > pyLines) return "TypeScript/JavaScript";
  return "backend";
}

function codeBlock(repo: RepoRecord): string {
  const hasPy = repo.javaCode.includes("FILE: ") && repo.javaCode.includes(".py");
  const hasTs = repo.javaCode.includes("FILE: ") && (repo.javaCode.includes(".ts") || repo.javaCode.includes(".js"));
  const lang = hasPy ? "python" : hasTs ? "typescript" : "text";
  return `### Repository: ${repo.name}
${repo.packageStructure ? `File Structure:\n${repo.packageStructure}` : ""}

\`\`\`${lang}
${repo.javaCode}
\`\`\``;
}

const STEP_PROMPTS: Record<number, (repos: RepoRecord[], previousResults: string) => string> = {
  1: (repos) => {
    const lang = detectLanguage(repos.map(r => r.javaCode).join("\n"));
    return `You are an expert software architect analyzing a ${lang} project.

## STEP 1 — Repository Discovery

Analyze the following repositories and produce a structured inventory for each one:

${repos.map(codeBlock).join("\n\n")}

For each repository, produce:
1. A Markdown table listing every source module (file), its purpose, and how many functions/classes it contains.
2. A summary of the top-level package/folder layout.
3. A list of all classes and standalone functions found.
4. Any notable third-party libraries imported.

Use this format exactly:

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
    const lang = detectLanguage(repos.map(r => r.javaCode).join("\n"));
    return `You are an expert software architect analyzing a ${lang} project.

## STEP 2 — Business Logic Classification

Previous analysis:
${previousResults}

Analyze these repositories and classify every function and class method:

${repos.map(codeBlock).join("\n\n")}

For every function or class method, assign exactly one of these categories:

- ✅ **Business Rule** — Performs calculations, validations, threshold checks, or enforces a domain rule
- ✅ **Orchestration** — Coordinates multiple business rules or process steps
- ❌ **Data Access** — Reads/writes DB, files, external APIs, caches (EXCLUDE)
- ❌ **Infrastructure** — Logging, config loading, retry logic, connection management (EXCLUDE)
- ❌ **UI/Frontend** — Templates, view rendering, serialization/deserialization (EXCLUDE)

**Classification rules:**
- If a function contains if/else, calculation, validation, or domain-specific decisions → Business Rule
- If it calls 2+ other business rules in sequence → Orchestration
- If it primarily calls DB queries, HTTP requests, or cache operations → Data Access (exclude)
- If you cannot determine the purpose → mark with ⚠️ NEEDS HUMAN REVIEW

For each module, produce:

### Module: [filename]

| Function/Method | Category | Include | Notes |
|-----------------|----------|---------|-------|
| ...             | ...      | Yes/No  | ...   |`;
  },

  3: (repos, previousResults) => {
    const lang = detectLanguage(repos.map(r => r.javaCode).join("\n"));
    return `You are an expert software architect analyzing a ${lang} project.

## STEP 3 — Business Rule Extraction

Previous analysis:
${previousResults}

Extract all business rules from these repositories:

${repos.map(codeBlock).join("\n\n")}

For every function classified as a Business Rule or Orchestration in Step 2, produce:

### [ModuleName] — [ClassName or "module-level"]

#### Rule: [Short descriptive name]
- **Function/Method:** \`functionName(params)\`
- **Plain English:** [1–3 sentences explaining what this rule does, with no code]
- **Inputs:** [parameter name: type — what it represents]
- **Output / Decision:** [what it returns or what branch it chooses]
- **Edge Cases / Conditions:** [notable conditional branches, guards, exception handling]
- **Suggested Module/Service:** [which microservice or functional module this belongs to]

Rules:
1. Never include DB queries, HTTP calls, or logging in your output
2. If a function mixes data access with logic, extract ONLY the logic portion and note it
3. Flag all constants and thresholds as potential business rules
4. If you cannot determine what a function does: ⚠️ NEEDS HUMAN REVIEW
5. Extract all branches of large if/else chains — they are almost always business rules`;
  },

  4: (repos, previousResults) => {
    const lang = detectLanguage(repos.map(r => r.javaCode).join("\n"));
    return `You are an expert software architect analyzing a ${lang} project.

## STEP 4 — Memory & State Dependency Map

Previous analysis:
${previousResults}

Identify all in-memory data structures, module-level state, and stateful dependencies in these repositories:

${repos.map(codeBlock).join("\n\n")}

For each module that holds or mutates in-memory state (Maps, objects, arrays, class properties, module-level variables, caches), produce:

### Memory Dependency: [module_name — ClassName or module scope]

- **Type of state:** [Map / object / array / class property / module-level variable / cache / etc.]
- **Variable name:** \`variableName\`
- **Access pattern:** READ / WRITE / BOTH
- **Keys or fields used:** [how the data is indexed or accessed]
- **Business context:** [what decision or rule depends on this state]
- **Migration note:** [suggested replacement — e.g., Redis, database table, or pass as argument]

If no in-memory state is found in a module, note it explicitly.

Also map any cross-module shared state (exported variables imported by multiple modules).`;
  },

  5: (repos, previousResults) => {
    const lang = detectLanguage(repos.map(r => r.javaCode).join("\n"));
    return `You are an expert software architect analyzing a ${lang} project.

## STEP 5 — Microservice Grouping Proposal

Previous analysis:
${previousResults}

Based on the business rules extracted, group them into logical microservice or module boundaries:

${repos.map(codeBlock).join("\n\n")}

Apply domain-driven design: group by bounded context, not by technical layer.

For each proposed microservice or module, produce:

## Proposed Service: [ServiceName]

- **Responsibility:** [One clear sentence describing what this service does]
- **Business rules it owns:** [list of rule names from Step 3]
- **Data it needs:** [data models, state dependencies from Step 4]
- **APIs it would expose:** [suggested REST endpoints or event-driven interfaces]
- **Dependencies on other services:** [list any cross-service calls needed]
- **Out of scope:** [what this service explicitly does NOT handle]

End with a **dependency graph** in text form showing how the proposed services relate to each other.`;
  },

  6: (repos, previousResults) => {
    const lang = detectLanguage(repos.map(r => r.javaCode).join("\n"));
    return `You are an expert software architect analyzing a ${lang} project.

## STEP 6 — Requirements Document

Previous analysis:
${previousResults}

Generate a complete, consolidated requirements document. Use plain English — no code, no implementation details.

${repos.map(codeBlock).join("\n\n")}

Produce the following sections:

---

# Codebase Requirements Report

## Executive Summary
[3–5 sentences summarizing what the codebase does, written for a non-technical stakeholder]

## System Overview
[Describe the system's purpose, users, and core domain]

---

For each proposed microservice from Step 5, generate:

# Requirements: [ServiceName]

## Purpose
[1 paragraph — what this service does and why it exists]

## Functional Requirements
1. [Plain-English requirement — no code]
2. ...

## Business Rules
1. [Rule name] — [plain-English description, inputs, and outcome]
2. ...

## Data Requirements
- [What data this service reads and writes, in plain English]

## API Contract
- \`[METHOD] /[endpoint]\` — [what it does and returns]

## Out of Scope
- [What this service explicitly does NOT do]

---

## Flagged Items ⚠️
List all items marked ⚠️ NEEDS HUMAN REVIEW with context explaining why human judgment is required.

---

## Consolidated Microservices Overview
A single table showing all proposed services, their responsibilities, and interdependencies.

| Service | Responsibility | Depends On |
|---------|---------------|------------|
| ...     | ...           | ...        |`;
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
    model: "nvidia/nemotron-3-super-120b-a12b:free",
    max_tokens: 8192,
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
