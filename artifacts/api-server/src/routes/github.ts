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

async function githubFetch(path: string, token?: string | null): Promise<Response | globalThis.Response> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "JavaModernizationAgent/1.0",
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
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

  // Get default branch if not specified
  let targetBranch = branch;
  if (!targetBranch) {
    const repoResp = await githubFetch(`/repos/${owner}/${repo}`, githubToken);
    if (!repoResp.ok) {
      const errText = await repoResp.text();
      if (repoResp.status === 404) {
        res.status(422).json({ error: `Repository not found: ${owner}/${repo}. Check the URL or make sure your token has access.` });
      } else if (repoResp.status === 403) {
        res.status(422).json({ error: "GitHub API rate limit exceeded. Provide a GitHub token to increase your rate limit." });
      } else {
        res.status(422).json({ error: `GitHub API error: ${errText}` });
      }
      return;
    }
    const repoData = await repoResp.json() as { default_branch: string };
    targetBranch = repoData.default_branch;
  }

  // Get full file tree
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
  const javaFiles = treeData.tree
    .filter((item) => item.type === "blob" && item.path.endsWith(".java"))
    .slice(0, limit);

  if (javaFiles.length === 0) {
    res.status(422).json({ error: `No .java files found in ${owner}/${repo} on branch '${targetBranch}'.` });
    return;
  }

  // Build package structure tree string
  const filePaths = javaFiles.map((f) => f.path);
  const packageStructure = buildFileTree(filePaths);

  // Fetch each file's content concurrently (in batches of 10)
  const codeParts: string[] = [];
  const batchSize = 10;

  for (let i = 0; i < javaFiles.length; i += batchSize) {
    const batch = javaFiles.slice(i, i + batchSize);
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
          return `// ===== FILE: ${file.path} =====\n${decoded}\n`;
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
  const isTruncated = treeData.truncated || javaFiles.length === limit;

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
