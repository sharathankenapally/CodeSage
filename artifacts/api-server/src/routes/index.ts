import { Router, type IRouter } from "express";
import healthRouter from "./health";
import analysesRouter from "./analyses";
import analyzeRouter from "./analyze";
import githubRouter from "./github";

const router: IRouter = Router();

router.use(healthRouter);
router.use(analysesRouter);
router.use(analyzeRouter);
router.use(githubRouter);

export default router;
