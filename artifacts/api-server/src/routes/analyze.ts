import { Router, type IRouter, type Request, type Response } from "express";
import { eq, and } from "drizzle-orm";
import { db, analysesTable, repositoriesTable, analysisResultsTable } from "@workspace/db";
import { openai } from "@workspace/integrations-openai-ai-server";
import {
  RunAnalysisStepParams,
  RunFullAnalysisParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

const STEP_NAMES: Record<number, string> = {
  1: "Repository Discovery",
  2: "Business Logic Classification",
  3: "Business Rule Extraction",
  4: "Memory Store Dependency Map",
  5: "Microservice Grouping Proposal",
  6: "English Requirements Document",
};

const STEP_PROMPTS: Record<number, (repos: Array<{ name: string; javaCode: string; packageStructure: string | null }>, previousResults: string) => string> = {
  1: (repos) => `You are an expert Java software architect analyzing a legacy Java 8 monolith for modernization.

## STEP 1 — Repository Discovery

Analyze the following Java repositories and produce an inventory for each one:

${repos.map(r => `### Repository: ${r.name}
${r.packageStructure ? `Package Structure Hint: ${r.packageStructure}` : ""}

\`\`\`java
${r.javaCode}
\`\`\``).join("\n\n")}

For each repository, produce a Markdown table with:
- Repo name
- Package structure (top-level packages found)
- Estimated number of service/manager/handler classes
- Presence of: @Service, @Component, @Stateful, @Singleton, or equivalent annotations
- Any class that references in-memory stores (HashMap, ConcurrentHashMap, Ehcache, Hazelcast, or custom cache objects)

Output a clear, structured Markdown report. Be thorough and specific.

Use this format:
## Repository Inventory

### [Repo Name]
| Property | Value |
|---|---|
| Package Structure | ... |
| Service/Manager Classes | ... |
| Annotations Found | ... |
| In-Memory Store References | ... |`,

  2: (repos, previousResults) => `You are an expert Java software architect analyzing a legacy Java 8 monolith for modernization.

## STEP 2 — Business Logic Classification

Previous analysis context:
${previousResults}

Now analyze these Java repositories and classify each method:

${repos.map(r => `### Repository: ${r.name}
\`\`\`java
${r.javaCode}
\`\`\``).join("\n\n")}

For every class you analyze, classify each method into one of these categories:
- ✅ Business Rule — Validates, transforms, calculates, or enforces a domain rule (INCLUDE)
- ✅ Orchestration Logic — Coordinates steps of a business process (INCLUDE)
- ❌ Data Fetch — Reads from DB, cache, or memory store (EXCLUDE)
- ❌ Data Write — Writes/updates DB, cache, or memory (EXCLUDE)
- ❌ Infrastructure — Logging, config, connection pooling, retry logic (EXCLUDE)
- ❌ UI Binding — Serialization, DTOs, view mappers (EXCLUDE)

**Rule:** If a method touches a data store (Oracle queries, JDBC calls, cache.get/put), exclude it. If it contains if/else, switch, calculation, or validation against domain objects — include it.

Produce a Markdown table for each class showing method name, category, and include/exclude decision.`,

  3: (repos, previousResults) => `You are an expert Java software architect analyzing a legacy Java 8 monolith for modernization.

## STEP 3 — Business Rule Extraction

Previous analysis context:
${previousResults}

Extract all business rules from these repositories:

${repos.map(r => `### Repository: ${r.name}
\`\`\`java
${r.javaCode}
\`\`\``).join("\n\n")}

For each class that contains business logic, produce a structured output:

## Class: [ClassName] — [RepoName]

**Domain Area:** [e.g., Pricing / Order Management / User Eligibility]

### Business Rules Found:

#### Rule 1: [Short rule name]
- **Method:** \`methodName(params)\`
- **Plain English:** [What this rule does, in 1-3 sentences]
- **Inputs:** [list of input parameters and their types]
- **Output / Decision:** [what it returns or what decision it makes]
- **Edge Cases / Conditions:** [any notable if/else branches]
- **Microservice Candidate:** [Yes/No — and suggested microservice name]

Rules:
1. Never include SQL queries or JDBC code in your output
2. Never include cache.get() / cache.put() operations
3. If a method is 80% data fetching and 20% logic, extract only the logic portion and note it
4. If you cannot determine what a method does, flag it with: ⚠️ NEEDS HUMAN REVIEW
5. Treat all static final constants as potential business rules or thresholds — document them
6. When you see large if/else if chains, these are almost always business rules — extract them all`,

  4: (repos, previousResults) => `You are an expert Java software architect analyzing a legacy Java 8 monolith for modernization.

## STEP 4 — Memory Store Dependency Map

Previous analysis context:
${previousResults}

Identify all classes that read from or write to in-memory stores in these repositories:

${repos.map(r => `### Repository: ${r.name}
\`\`\`java
${r.javaCode}
\`\`\``).join("\n\n")}

For each class that uses in-memory stores (HashMap, ConcurrentHashMap, Ehcache, Hazelcast, custom caches), produce:

## Memory Dependency: [ClassName]

- **Type of access:** READ / WRITE / BOTH
- **Data structure used:** [HashMap / ConcurrentHashMap / custom cache / etc.]
- **Keys used:** [what keys are used to look up data]
- **Business context:** [why this data is needed — what decision depends on it]
- **Couchbase migration note:** [suggested document model or collection name in Couchbase]

If no in-memory stores are found, note that and describe any persistence patterns observed.`,

  5: (repos, previousResults) => `You are an expert Java software architect analyzing a legacy Java 8 monolith for modernization.

## STEP 5 — Microservice Grouping Proposal

Previous analysis context:
${previousResults}

Based on the business rules extracted from these repositories, propose a microservice architecture:

${repos.map(r => `### Repository: ${r.name}
\`\`\`java
${r.javaCode}
\`\`\``).join("\n\n")}

Group the extracted business rules into logical microservice boundaries:

## Proposed Microservice: [ServiceName]

- **Responsibility:** [One sentence]
- **Business rules it owns:** [list rule names from Step 3]
- **Data it needs from Couchbase:** [collections / document types]
- **APIs it exposes:** [suggested REST or event-driven endpoints]
- **Dependencies on other microservices:** [list]

Consider domain-driven design principles. Group services by bounded context.`,

  6: (repos, previousResults) => `You are an expert Java software architect analyzing a legacy Java 8 monolith for modernization.

## STEP 6 — English Requirements Document

Previous analysis context:
${previousResults}

Generate English Requirements files for each proposed microservice. Use the full context of the analysis.

${repos.map(r => `### Repository: ${r.name}
\`\`\`java
${r.javaCode}
\`\`\``).join("\n\n")}

For each proposed microservice, generate:

# Requirements: [ServiceName]

## Purpose
[1 paragraph describing what this service does and why it exists]

## Business Rules
1. [Rule written in plain English, no code]
2. ...

## Data Contract
- Reads from Couchbase collection: \`[collection_name]\`
- Document structure expected: \`{ field: type, ... }\`

## API Contract
- \`POST /endpoint\` — [what it does]
- \`GET /endpoint/{id}\` — [what it returns]

## Out of Scope
- [What this service explicitly does NOT do]

---

Also produce these consolidated files:

### microservices-proposal.md
A consolidated overview of all proposed microservices.

### Migration Strategy
Brief notes on migration order and dependencies between services.`,
};

async function runStep(
  analysisId: number,
  step: number,
  repos: Array<{ name: string; javaCode: string; packageStructure: string | null }>,
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

  const stream = await openai.chat.completions.create({
    model: "gpt-5.2",
    max_completion_tokens: 8192,
    messages: [
      {
        role: "system",
        content:
          "You are an expert Java software architect specializing in legacy modernization. Produce detailed, structured Markdown output following the given format exactly. Be thorough, specific, and actionable.",
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
