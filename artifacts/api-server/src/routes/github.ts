import { Router, type IRouter, type Request, type Response } from "express";
import { FetchGithubRepoBody } from "@workspace/api-zod";

const router: IRouter = Router();

interface GithubTreeItem {
  path: string;
  type: string;
  sha: string;
  url: string;
}

interface GithubTreeResponse {
  tree: GithubTreeItem[];
  truncated: boolean;
}

interface GithubFileContent {
  content: string;
  encoding: string;
}

const BACKEND_EXTENSIONS = [".py", ".ts", ".js"];
const UI_PATTERNS = [".tsx", ".jsx", ".vue", ".svelte", ".css", ".scss", ".less", ".html"];
const IGNORE_PATHS = [
  "__pycache__", ".egg-info", "node_modules", ".git", "venv", ".venv",
  "dist", "build", "migrations", ".tox", ".pytest_cache", "coverage",
  ".generated", "generated", ".min.", ".d.ts",
];
const IGNORE_FILE_PATTERNS = [
  ".test.", ".spec.", ".stories.", "jest.config", "vite.config",
  "tailwind.config", "postcss.config", "eslint", ".prettierrc",
  "drizzle.config", "orval.config", "tsconfig", "package.json", "pnpm-lock",
];

function isBackendFile(path: string): boolean {
  if (IGNORE_PATHS.some((ignore) => path.includes(ignore))) return false;
  if (UI_PATTERNS.some((ext) => path.endsWith(ext))) return false;
  if (IGNORE_FILE_PATTERNS.some((pat) => path.includes(pat))) return false;
  return BACKEND_EXTENSIONS.some((ext) => path.endsWith(ext));
}

function parseGithubUrl(url: string): { owner: string; repo: string } | null {
  try {
    const cleaned = url.trim().replace(/\.git$/, "").replace(/\/$/, "");
    const match = cleaned.match(/github\.com[/:]([^/]+)\/([^/]+)/);
    if (!match) return null;
    return { owner: match[1], repo: match[2] };
  } catch {
    return null;
  }
}

async function githubFetch(path: string, token?: string | null): Promise<globalThis.Response> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "PythonCodeAnalyzer/1.0",
  };
  const resolvedToken = token || process.env.GITHUB_TOKEN;
  if (resolvedToken) {
    headers["Authorization"] = `Bearer ${resolvedToken}`;
  }
  return fetch(`https://api.github.com${path}`, { headers });
}

router.post("/github/fetch", async (req: Request, res: Response): Promise<void> => {
  const parsed = FetchGithubRepoBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { repoUrl, branch, githubToken, maxFiles } = parsed.data;
  const limit = maxFiles ?? 100;

  const parts = parseGithubUrl(repoUrl);
  if (!parts) {
    res.status(400).json({ error: "Invalid GitHub URL. Expected format: https://github.com/owner/repo" });
    return;
  }

  const { owner, repo } = parts;

  let targetBranch = branch;
  if (!targetBranch) {
    const repoResp = await githubFetch(`/repos/${owner}/${repo}`, githubToken);
    if (!repoResp.ok) {
      if (repoResp.status === 404) {
        res.status(422).json({ error: `Repository not found: ${owner}/${repo}. Check the URL or ensure your token has access.` });
      } else if (repoResp.status === 403) {
        res.status(422).json({ error: "GitHub API rate limit exceeded. Provide a GitHub token to increase your rate limit." });
      } else {
        const errText = await repoResp.text();
        res.status(422).json({ error: `GitHub API error: ${errText}` });
      }
      return;
    }
    const repoData = await repoResp.json() as { default_branch: string };
    targetBranch = repoData.default_branch;
  }

  const treeResp = await githubFetch(
    `/repos/${owner}/${repo}/git/trees/${targetBranch}?recursive=1`,
    githubToken
  );

  if (!treeResp.ok) {
    const errText = await treeResp.text();
    res.status(422).json({ error: `Could not fetch repository tree: ${errText}` });
    return;
  }

  const treeData = await treeResp.json() as GithubTreeResponse;
  const backendFiles = treeData.tree
    .filter((item) => item.type === "blob" && isBackendFile(item.path))
    .slice(0, limit);

  if (backendFiles.length === 0) {
    res.status(422).json({
      error: `No backend source files (.py, .ts, .js) found in ${owner}/${repo} on branch '${targetBranch}'. The repository may be empty, use unsupported languages, or only contain frontend/UI code.`,
    });
    return;
  }

  const filePaths = backendFiles.map((f) => f.path);
  const packageStructure = buildFileTree(filePaths);

  const codeParts: string[] = [];
  const batchSize = 10;

  for (let i = 0; i < backendFiles.length; i += batchSize) {
    const batch = backendFiles.slice(i, i + batchSize);
    const results = await Promise.allSettled(
      batch.map(async (file) => {
        const fileResp = await githubFetch(
          `/repos/${owner}/${repo}/contents/${file.path}?ref=${targetBranch}`,
          githubToken
        );
        if (!fileResp.ok) return null;
        const fileData = await fileResp.json() as GithubFileContent;
        if (fileData.encoding === "base64") {
          const decoded = Buffer.from(fileData.content.replace(/\n/g, ""), "base64").toString("utf-8");
          const commentPrefix = file.path.endsWith(".py") ? "#" : "//";
          return `${commentPrefix} ===== FILE: ${file.path} =====\n${decoded}\n`;
        }
        return null;
      })
    );

    for (const result of results) {
      if (result.status === "fulfilled" && result.value) {
        codeParts.push(result.value);
      }
    }
  }

  const javaCode = codeParts.join("\n");
  const isTruncated = treeData.truncated || backendFiles.length === limit;

  res.json({
    name: `${owner}/${repo}`,
    javaCode,
    packageStructure,
    fileCount: codeParts.length,
    truncated: isTruncated,
  });
});

function buildFileTree(paths: string[]): string {
  const tree: Record<string, unknown> = {};

  for (const p of paths) {
    const parts = p.split("/");
    let node = tree;
    for (const part of parts) {
      if (!node[part]) {
        node[part] = {};
      }
      node = node[part] as Record<string, unknown>;
    }
  }

  const lines: string[] = [];
  function render(node: Record<string, unknown>, prefix: string) {
    const keys = Object.keys(node).sort();
    keys.forEach((key, i) => {
      const isLast = i === keys.length - 1;
      const connector = isLast ? "└── " : "├── ";
      const childPrefix = isLast ? "    " : "│   ";
      lines.push(`${prefix}${connector}${key}`);
      const child = node[key] as Record<string, unknown>;
      if (Object.keys(child).length > 0) {
        render(child, prefix + childPrefix);
      }
    });
  }

  render(tree, "");
  return lines.join("\n");
}

export default router;
