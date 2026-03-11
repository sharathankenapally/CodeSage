import { Router, type IRouter, type Request, type Response } from "express";
import { eq } from "drizzle-orm";
import { db, analysesTable, repositoriesTable, analysisResultsTable } from "@workspace/db";
import {
  CreateAnalysisBody,
  CreateRepositoryBody,
  GetAnalysisParams,
  DeleteAnalysisParams,
  ListRepositoriesParams,
  CreateRepositoryParams,
  DeleteRepositoryParams,
  ListResultsParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/analyses", async (_req, res): Promise<void> => {
  const analyses = await db
    .select()
    .from(analysesTable)
    .orderBy(analysesTable.createdAt);
  res.json(analyses);
});

router.post("/analyses", async (req: Request, res: Response): Promise<void> => {
  const parsed = CreateAnalysisBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [analysis] = await db
    .insert(analysesTable)
    .values({
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      status: "pending",
    })
    .returning();

  res.status(201).json(analysis);
});

router.get("/analyses/:id", async (req: Request, res: Response): Promise<void> => {
  const params = GetAnalysisParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [analysis] = await db
    .select()
    .from(analysesTable)
    .where(eq(analysesTable.id, params.data.id));

  if (!analysis) {
    res.status(404).json({ error: "Analysis not found" });
    return;
  }

  res.json(analysis);
});

router.delete("/analyses/:id", async (req: Request, res: Response): Promise<void> => {
  const params = DeleteAnalysisParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [deleted] = await db
    .delete(analysesTable)
    .where(eq(analysesTable.id, params.data.id))
    .returning();

  if (!deleted) {
    res.status(404).json({ error: "Analysis not found" });
    return;
  }

  res.sendStatus(204);
});

router.get("/analyses/:id/repositories", async (req: Request, res: Response): Promise<void> => {
  const params = ListRepositoriesParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const repos = await db
    .select()
    .from(repositoriesTable)
    .where(eq(repositoriesTable.analysisId, params.data.id))
    .orderBy(repositoriesTable.createdAt);

  res.json(repos);
});

router.post("/analyses/:id/repositories", async (req: Request, res: Response): Promise<void> => {
  const params = CreateRepositoryParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = CreateRepositoryBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [analysis] = await db
    .select()
    .from(analysesTable)
    .where(eq(analysesTable.id, params.data.id));

  if (!analysis) {
    res.status(404).json({ error: "Analysis not found" });
    return;
  }

  const [repo] = await db
    .insert(repositoriesTable)
    .values({
      analysisId: params.data.id,
      name: parsed.data.name,
      javaCode: parsed.data.javaCode,
      packageStructure: parsed.data.packageStructure ?? null,
    })
    .returning();

  res.status(201).json(repo);
});

router.delete("/analyses/:id/repositories/:repoId", async (req: Request, res: Response): Promise<void> => {
  const params = DeleteRepositoryParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [deleted] = await db
    .delete(repositoriesTable)
    .where(eq(repositoriesTable.id, params.data.repoId))
    .returning();

  if (!deleted) {
    res.status(404).json({ error: "Repository not found" });
    return;
  }

  res.sendStatus(204);
});

router.get("/analyses/:id/results", async (req: Request, res: Response): Promise<void> => {
  const params = ListResultsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const results = await db
    .select()
    .from(analysisResultsTable)
    .where(eq(analysisResultsTable.analysisId, params.data.id))
    .orderBy(analysisResultsTable.step);

  res.json(results);
});

export default router;
